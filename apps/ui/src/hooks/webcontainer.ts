import { useCallback } from 'react';
import { toast } from 'sonner';
import { FileSystemTree, IFSWatcher, WebContainer } from '@webcontainer/api';
import { isStaleStarterTree, resolveProjectTree } from '@/data/project-file';
import type { OrinAction } from '@/lib/orin-artifact';
import {
    detectPackageManager,
    getInstallCommand,
    getMissingDependencies,
    getProjectRoot,
    getProjectRootFromTree,
    getWebContainerDevCommand,
    WEBCONTAINER_VITE_DEV_COMMAND,
    isDevServerCommand,
    needsInstall,
    parseShellCommand,
    splitShellCommandChain,
    type PackageCommand,
} from '@/lib/package-manager';
import { useIDEStore } from '@/stores/ideStore';

type OutputWriter = (data: string) => void;

/** Changes made to the container filesystem from outside the IDE (the terminal, npm, scripts). */
export type ContainerFileChangeHandler = (changes: OrinAction[]) => void;

interface FileWatchState {
    watcher: IFSWatcher | null;
    root: string;
    handler: ContainerFileChangeHandler | null;
    pending: Set<string>;
    flushTimer: ReturnType<typeof setTimeout> | null;
    flushing: Promise<void> | null;
    /** While > 0 the IDE is writing to the container itself; events wait until it is done. */
    pausedDepth: number;
}

interface WebContainerRuntime {
    container: WebContainer | null;
    boot: Promise<WebContainer> | null;
    initialize: Promise<WebContainer> | null;
    install: Promise<void> | null;
    treeKey: string | null;
    serverReadyBound: boolean;
    devServerRunning: boolean;
    fileWatch: FileWatchState;
}

declare global {
    var __ORIN_WEBCONTAINER_RUNTIME__: WebContainerRuntime | undefined;
}

// WebContainer survives Fast Refresh, so its reference must too.
const runtime =
    globalThis.__ORIN_WEBCONTAINER_RUNTIME__ ??
    (globalThis.__ORIN_WEBCONTAINER_RUNTIME__ = {
        container: null,
        boot: null,
        initialize: null,
        install: null,
        treeKey: null,
        serverReadyBound: false,
        devServerRunning: false,
        fileWatch: {
            watcher: null,
            root: '/',
            handler: null,
            pending: new Set(),
            flushTimer: null,
            flushing: null,
            pausedDepth: 0,
        },
    });

let outputWriter: OutputWriter | null = null;
const outputLog: string[] = [];

function writeOutput(data: string) {
    outputLog.push(data);
    outputWriter?.(data);
}

function treeKey(tree: FileSystemTree) {
    return Object.keys(tree).sort().join('\0');
}

// Build output and dependency folders never belong in the project tree.
const UNWATCHED_SEGMENTS = new Set([
    'node_modules',
    '.git',
    'dist',
    '.vite',
    '.cache',
    '.npm',
    '.pnpm-store',
    '.turbo',
    '.next',
]);
const MAX_SYNCED_FILE_BYTES = 512 * 1024;
const FILE_WATCH_DEBOUNCE_MS = 250;

function normalizeContainerPath(path: string) {
    return path.replace(/^\/+|\/+$/g, '');
}

function isUnwatchedPath(path: string) {
    return path.split('/').some((segment) => UNWATCHED_SEGMENTS.has(segment));
}

function treeHasEntry(tree: FileSystemTree, path: string): boolean {
    let current: FileSystemTree = tree;
    const parts = path.split('/').filter(Boolean);
    for (let index = 0; index < parts.length; index += 1) {
        const node = current[parts[index]];
        if (!node) return false;
        if (index === parts.length - 1) return true;
        if (!('directory' in node)) return false;
        current = node.directory;
    }
    return false;
}

/**
 * Reads the current state of each changed path. Directories are only walked
 * for entries the tree does not know yet; files inside them that changed get
 * their own events. Binary and oversized files are left out of the tree.
 */
async function collectContainerChanges(
    container: WebContainer,
    paths: Iterable<string>,
): Promise<OrinAction[]> {
    const tree = useIDEStore.getState().fileStructure;
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const queue = [...paths];
    const seen = new Set<string>();
    const changes: OrinAction[] = [];

    while (queue.length > 0) {
        const path = queue.shift()!;
        if (!path || seen.has(path) || isUnwatchedPath(path)) continue;
        seen.add(path);

        const absolute = `/${path}`;
        try {
            const entries = await container.fs.readdir(absolute, { withFileTypes: true });
            changes.push({ type: 'directory', path });
            for (const entry of entries) {
                const childPath = `${path}/${entry.name}`;
                if (!treeHasEntry(tree, childPath)) queue.push(childPath);
            }
            continue;
        } catch {
            // Not a directory.
        }

        try {
            const bytes = await container.fs.readFile(absolute);
            if (bytes.byteLength > MAX_SYNCED_FILE_BYTES) continue;
            let content: string;
            try {
                content = decoder.decode(bytes);
            } catch {
                continue;
            }
            changes.push({ type: 'file', path, content });
            continue;
        } catch {
            // Gone.
        }

        changes.push({ type: 'delete', path });
    }

    return changes;
}

function scheduleFileWatchFlush() {
    const state = runtime.fileWatch;
    if (state.flushTimer) clearTimeout(state.flushTimer);
    state.flushTimer = setTimeout(() => {
        state.flushTimer = null;
        void flushFileWatch();
    }, FILE_WATCH_DEBOUNCE_MS);
}

async function flushFileWatch() {
    const state = runtime.fileWatch;
    const container = runtime.container;
    if (!container || state.pausedDepth > 0 || state.pending.size === 0) return;
    if (state.flushing) return state.flushing;

    const paths = [...state.pending];
    state.pending.clear();
    state.flushing = (async () => {
        try {
            const changes = await collectContainerChanges(container, paths);
            if (changes.length > 0) state.handler?.(changes);
        } catch (error) {
            console.warn('[IDE] Could not sync terminal file changes:', error);
        }
    })();

    try {
        await state.flushing;
    } finally {
        state.flushing = null;
        if (state.pending.size > 0) scheduleFileWatchFlush();
    }
}

/** Mirrors filesystem changes made in the terminal back into the project tree. */
function startFileWatcher(container: WebContainer, root: string) {
    const state = runtime.fileWatch;
    state.watcher?.close();
    state.pending.clear();
    state.root = root;

    const rootPrefix = normalizeContainerPath(root);
    state.watcher = container.fs.watch(root, { recursive: true }, (_event, filename) => {
        const name = typeof filename === 'string' ? filename : new TextDecoder().decode(filename);
        const relative = normalizeContainerPath(name);
        const path = rootPrefix && !relative.startsWith(`${rootPrefix}/`) && relative !== rootPrefix
            ? `${rootPrefix}/${relative}`
            : relative;
        if (!path || isUnwatchedPath(path)) return;
        state.pending.add(path);
        scheduleFileWatchFlush();
    });
}

/**
 * The IDE's own writes to the container also raise watch events. Pausing
 * around them lets the tree update first, so the echoed events are no-ops.
 */
export function pauseContainerFileSync() {
    runtime.fileWatch.pausedDepth += 1;
}

export function resumeContainerFileSync() {
    const state = runtime.fileWatch;
    state.pausedDepth = Math.max(0, state.pausedDepth - 1);
    if (state.pausedDepth === 0 && state.pending.size > 0) scheduleFileWatchFlush();
}

function bootContainer() {
    if (runtime.container) return Promise.resolve(runtime.container);

    runtime.boot ??= WebContainer.boot({
        coep: 'require-corp',
        forwardPreviewErrors: true,
    })
        .then((container) => {
            runtime.container = container;
            return container;
        })
        .catch((error: unknown) => {
            runtime.boot = null;
            runtime.container = null;
            throw error;
        });

    return runtime.boot;
}

async function runProcess(
    container: WebContainer,
    { command, args, label }: PackageCommand,
    cwd: string,
) {
    const process = await container.spawn(command, args, { cwd });
    void process.output.pipeTo(new WritableStream<string>({ write: writeOutput }));

    const exitCode = await process.exit;
    if (exitCode !== 0) {
        throw new Error(`"${label}" failed with exit code ${exitCode}`);
    }
}

async function setupCommands(container: WebContainer, projectRoot: string) {
    const manager = await detectPackageManager(container.fs, projectRoot);
    const install = getInstallCommand(manager).label;
    const dev = `${WEBCONTAINER_VITE_DEV_COMMAND.command} ${WEBCONTAINER_VITE_DEV_COMMAND.label}`;
    return { install, dev, hint: `${install}\n${dev}` };
}

/**
 * Installs dependencies that were added to package.json after the user's own
 * install. A full install is never started here: until `node_modules` exists
 * the user runs it from the terminal themselves.
 */
async function installNewDependencies(
    container: WebContainer,
    projectRoot: string,
    setLoadingMessage: (message: string) => void,
) {
    if (runtime.install) return runtime.install;

    const task = (async () => {
        if (await needsInstall(container.fs, projectRoot)) {
            const { install } = await setupCommands(container, projectRoot);
            writeOutput(`\r\n# package.json changed. Run \`${install}\` in the terminal when ready.\r\n`);
            return;
        }

        const missing = await getMissingDependencies(container.fs, projectRoot);
        if (missing.length === 0) return;

        const manager = await detectPackageManager(container.fs, projectRoot);
        const command = getInstallCommand(manager);
        setLoadingMessage(`Installing dependencies (${command.label})...`);
        writeOutput(`\r\n$ ${command.label}\r\n`);
        await runProcess(container, command, projectRoot);
        toast.success('Dependencies installed');
    })();

    runtime.install = task;
    try {
        await task;
    } finally {
        if (runtime.install === task) runtime.install = null;
    }
}

async function startDevServer(container: WebContainer, projectRoot: string, onExit: () => void) {
    if (runtime.devServerRunning) return;
    runtime.devServerRunning = true;

    try {
        const command = await getWebContainerDevCommand(container.fs, projectRoot);
        writeOutput(`\r\n$ ${command.label}\r\n`);
        const process = await container.spawn(command.command, command.args, {
            cwd: projectRoot,
        });
        void process.output.pipeTo(new WritableStream<string>({ write: writeOutput }));
        void process.exit.then((exitCode) => {
            runtime.devServerRunning = false;
            if (exitCode !== 0) onExit();
        });
    } catch (error) {
        runtime.devServerRunning = false;
        throw error;
    }
}

export const useWebContainer = () => {
    const {
        webContainerRef,
        isContainerBooted,
        setContainerError,
        setIsContainerBooted,
        setIsLoading,
        setLiveUrl,
        setLoadingMessage,
        setSetupHint,
    } = useIDEStore();

    const setTerminalOutput = useCallback((write: OutputWriter) => {
        outputWriter = write;
        if (outputLog.length > 0) write(outputLog.join(''));
    }, []);

    const initializeWebContainer = useCallback(
        async (fileTree: FileSystemTree, projectId?: string) => {
            const key = projectId ?? treeKey(fileTree);
            if (runtime.treeKey === key && runtime.container) {
                webContainerRef.current = runtime.container;
                setIsContainerBooted(true);
                setIsLoading(false);
                return runtime.container;
            }
            if (runtime.initialize) return runtime.initialize;

            const task = (async () => {
                try {
                    setContainerError(null);
                    setLoadingMessage('Booting Container...');
                    const container = await bootContainer();
                    webContainerRef.current = container;

                    if (!runtime.serverReadyBound) {
                        runtime.serverReadyBound = true;
                        container.on('server-ready', (_port, url) => {
                            setLiveUrl(url);
                            setContainerError(null);
                            setSetupHint(null);
                            toast.success('Preview server is ready');
                        });
                        container.on('preview-message', (message) => {
                            writeOutput(
                                `\r\n# Preview error: ${'message' in message ? message.message : JSON.stringify(message)}\r\n`,
                            );
                        });
                    }

                    if (runtime.treeKey && runtime.treeKey !== key) {
                        runtime.devServerRunning = false;
                        setLiveUrl(null);
                    }
                    runtime.fileWatch.watcher?.close();
                    runtime.fileWatch.watcher = null;

                    setIsLoading(true);
                    setLoadingMessage('Mounting project files...');
                    const tree = isStaleStarterTree(fileTree)
                        ? resolveProjectTree(fileTree)
                        : fileTree;
                    await container.mount(tree);

                    const projectRoot =
                        (await getProjectRoot(container.fs)) ?? getProjectRootFromTree(tree);
                    startFileWatcher(container, projectRoot ?? '/');

                    if (projectRoot && (await needsInstall(container.fs, projectRoot))) {
                        // Dependencies are installed by the user, not on boot.
                        const commands = await setupCommands(container, projectRoot);
                        setSetupHint(commands.hint);
                        writeOutput(
                            `\r\n# Dependencies are not installed. Run these to start the preview:\r\n` +
                                `#   ${commands.install}\r\n#   ${commands.dev}\r\n`,
                        );
                    } else if (projectRoot) {
                        setSetupHint(null);
                        setLoadingMessage('Starting Vite dev server...');
                        await startDevServer(container, projectRoot, () => {
                            setLiveUrl(null);
                            setContainerError('The dev server stopped. Check the terminal output.');
                        });
                    }

                    runtime.treeKey = key;
                    setIsContainerBooted(true);
                    return container;
                } catch (error) {
                    const message =
                        error instanceof Error ? error.message : 'Unknown WebContainer error';
                    console.error('WebContainer error:', error);
                    setLiveUrl(null);
                    setContainerError(message);
                    setIsContainerBooted(false);
                    toast.error(`Failed to start WebContainer: ${message}`);
                    throw error;
                } finally {
                    setIsLoading(false);
                }
            })();

            runtime.initialize = task;
            try {
                return await task;
            } finally {
                if (runtime.initialize === task) runtime.initialize = null;
            }
        },
        [
            setContainerError,
            setIsContainerBooted,
            setIsLoading,
            setLiveUrl,
            setLoadingMessage,
            setSetupHint,
            webContainerRef,
        ],
    );

    const syncProjectDependencies = useCallback(async () => {
        const container = webContainerRef.current;
        if (!container) return;

        try {
            const projectRoot = await getProjectRoot(container.fs);
            if (projectRoot) {
                await installNewDependencies(container, projectRoot, setLoadingMessage);
            }
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? `Install failed: ${error.message}`
                    : 'Could not install dependencies',
            );
        }
    }, [setLoadingMessage, webContainerRef]);

    const runCommand = useCallback(
        async (command: string, args: string[], cwd?: string) => {
            const container = webContainerRef.current;
            if (!container) throw new Error('WebContainer not initialized');

            const projectRoot = cwd ?? (await getProjectRoot(container.fs)) ?? '/';
            const process = await container.spawn(command, args, { cwd: projectRoot });
            void process.output.pipeTo(new WritableStream<string>({ write: writeOutput }));
            return process;
        },
        [webContainerRef],
    );

    const runShellCommand = useCallback(
        async (rawCommand: string, cwd?: string) => {
            const container = webContainerRef.current;
            if (!container) throw new Error('WebContainer not initialized');

            const projectRoot = cwd ?? (await getProjectRoot(container.fs)) ?? '/';
            const commands = splitShellCommandChain(rawCommand);
            if (commands.length === 0) throw new Error('Shell command is empty');

            for (const command of commands) {
                if (runtime.devServerRunning && isDevServerCommand(command)) {
                    writeOutput(`\r\n# skipped: ${command}\r\n`);
                    continue;
                }
                const parsed = parseShellCommand(command);
                writeOutput(`\r\n$ ${parsed.label}\r\n`);
                await runProcess(container, parsed, projectRoot);
            }
        },
        [webContainerRef],
    );

    const writeFile = useCallback(
        async (path: string, content: string) => {
            const container = webContainerRef.current;
            if (!container) throw new Error('WebContainer not initialized');
            await container.fs.writeFile(path.startsWith('/') ? path : `/${path}`, content);
        },
        [webContainerRef],
    );

    const onContainerFileChange = useCallback((handler: ContainerFileChangeHandler | null) => {
        runtime.fileWatch.handler = handler;
        return () => {
            if (runtime.fileWatch.handler === handler) runtime.fileWatch.handler = null;
        };
    }, []);

    const readFile = useCallback(
        async (path: string) => {
            const container = webContainerRef.current;
            if (!container) throw new Error('WebContainer not initialized');
            return container.fs.readFile(path.startsWith('/') ? path : `/${path}`, 'utf-8');
        },
        [webContainerRef],
    );

    return {
        webContainerRef,
        initializeWebContainer,
        syncProjectDependencies,
        runCommand,
        runShellCommand,
        writeFile,
        readFile,
        onContainerFileChange,
        setTerminalOutput,
        isContainerBooted,
    };
};
