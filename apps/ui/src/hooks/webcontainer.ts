import { useIDEStore } from "@/stores/ideStore";
import {
  detectPackageManager,
  getInstallCommand,
  getProjectRoot,
  getProjectRootFromTree,
  getWebContainerDevCommand,
  isDevServerCommand,
  needsInstall,
  parseShellCommand,
  splitShellCommandChain,
  type PackageCommand,
} from "@/lib/package-manager";
import {
  isStaleStarterTree,
  resolveProjectTree,
} from "@/data/project-file";
import { WebContainer, FileSystemTree } from "@webcontainer/api";
import { useCallback } from "react";
import { toast } from "sonner";

type OutputWriter = (data: string) => void;

let bootPromise: Promise<WebContainer> | null = null;
let containerInstance: WebContainer | null = null;
let initPromise: Promise<WebContainer> | null = null;
let initializedTreeKey: string | null = null;
let serverReadyBound = false;
let devStarted = false;
let outputWriter: OutputWriter | null = null;
const outputLog: string[] = [];
let terminalWaiters: Array<() => void> = [];

function treeKey(tree: FileSystemTree): string {
  return Object.keys(tree).sort().join("\0");
}

function writeOutput(data: string) {
  outputLog.push(data);
  outputWriter?.(data);
}

function resolveTerminalWaiters() {
  const waiters = terminalWaiters;
  terminalWaiters = [];
  for (const resolve of waiters) resolve();
}

function attachTerminalWriter(write: OutputWriter) {
  outputWriter = write;
  if (outputLog.length > 0) {
    write(outputLog.join(""));
  }
  resolveTerminalWaiters();
}

function waitForTerminal(timeoutMs = 5000): Promise<void> {
  if (outputWriter) return Promise.resolve();

  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, timeoutMs);
    terminalWaiters.push(() => {
      window.clearTimeout(timer);
      resolve();
    });
  });
}

function getOrBootContainer(): Promise<WebContainer> {
  if (containerInstance) return Promise.resolve(containerInstance);

  if (!bootPromise) {
    bootPromise = WebContainer.boot()
      .then((container) => {
        containerInstance = container;
        return container;
      })
      .catch((error: unknown) => {
        bootPromise = null;
        containerInstance = null;
        throw error;
      });
  }

  return bootPromise;
}

async function runProcess(
  wc: WebContainer,
  { command, args, label }: PackageCommand,
  cwd: string,
  onOutput?: (data: string) => void,
): Promise<number> {
  const process = await wc.spawn(command, args, { cwd });

  process.output.pipeTo(
    new WritableStream<string>({
      write(data) {
        onOutput?.(data);
      },
    }),
  );

  const exitCode = await process.exit;
  if (exitCode !== 0) {
    throw new Error(`"${label}" failed with exit code ${exitCode}`);
  }

  return exitCode;
}

async function startDevServer(wc: WebContainer, projectRoot: string) {
  if (devStarted) return;
  devStarted = true;

  try {
    const devCommand = await getWebContainerDevCommand(
      wc.fs,
      projectRoot,
    );
    writeOutput(`\r\n$ ${devCommand.label}\r\n`);
    const process = await wc.spawn(devCommand.command, devCommand.args, {
      cwd: projectRoot,
    });
    void process.output.pipeTo(
      new WritableStream<string>({
        write(data) {
          writeOutput(data);
        },
      }),
    );
  } catch (error) {
    devStarted = false;
    throw error;
  }
}

export const useWebContainer = () => {
  const {
    webContainerRef,
    setLiveUrl,
    setIsLoading,
    setLoadingMessage,
    setContainerError,
    setIsContainerBooted,
    isContainerBooted,
  } = useIDEStore();

  const setTerminalOutput = useCallback((callback: (data: string) => void) => {
    attachTerminalWriter(callback);
  }, []);

  const installDependencies = useCallback(
    async (wc: WebContainer, projectRoot: string) => {
      if (!(await needsInstall(wc.fs, projectRoot))) {
        return;
      }

      const manager = await detectPackageManager(wc.fs, projectRoot);
      const installCommand = getInstallCommand(manager);

      if (manager === "bun") {
        toast.info(
          "Bun lockfile detected. Using npm in the browser sandbox (native bun is not available in WebContainer).",
        );
      }

      setLoadingMessage(`Installing dependencies (${installCommand.label})...`);
      writeOutput(`\r\n$ ${installCommand.label}\r\n`);
      await runProcess(wc, installCommand, projectRoot, writeOutput);
      toast.success("Dependencies installed");
    },
    [setLoadingMessage],
  );

  const initializeWebContainer = useCallback(
    async (fileTree: FileSystemTree, projectId?: string) => {
      const key = projectId ?? treeKey(fileTree);

      if (initializedTreeKey === key && containerInstance) {
        webContainerRef.current = containerInstance;
        setIsContainerBooted(true);
        setIsLoading(false);
        return containerInstance;
      }

      if (initPromise) {
        return initPromise;
      }

      initPromise = (async () => {
        try {
          setContainerError(null);
          setLoadingMessage("Booting Container...");
          const wc = await getOrBootContainer();
          webContainerRef.current = wc;

          if (!serverReadyBound) {
            serverReadyBound = true;
            wc.on("server-ready", (port, url) => {
              setLiveUrl(url);
              toast.success(`Server running on port ${port} 🚀`);
            });
          }

          if (initializedTreeKey && initializedTreeKey !== key) {
            devStarted = false;
            setIsContainerBooted(false);
            setLiveUrl(null);
          }

          setIsLoading(true);
          setLoadingMessage("Mounting project files...");
          const treeToMount = isStaleStarterTree(fileTree)
            ? resolveProjectTree(fileTree)
            : fileTree;
          await wc.mount(treeToMount);
          toast.success("Project files loaded successfully! 🚀");

          await waitForTerminal();

          const projectRoot =
            (await getProjectRoot(wc.fs)) ??
            getProjectRootFromTree(treeToMount);
          if (projectRoot) {
            await installDependencies(wc, projectRoot);
            setLoadingMessage("Starting Vite dev server...");
            await startDevServer(wc, projectRoot);
          }

          initializedTreeKey = key;
          setIsContainerBooted(true);
          setIsLoading(false);
          return wc;
        } catch (error) {
          console.error("WebContainer error:", error);
          const message =
            error instanceof Error
              ? error.message
              : "Unknown WebContainer error";
          setContainerError(message);
          setIsContainerBooted(false);
          toast.error(`Failed to start WebContainer: ${message}`);
          initializedTreeKey = null;
          webContainerRef.current = containerInstance;
          setIsLoading(false);
          throw error;
        } finally {
          initPromise = null;
        }
      })();

      return initPromise;
    },
    [
      webContainerRef,
      setLiveUrl,
      setIsLoading,
      setLoadingMessage,
      setContainerError,
      setIsContainerBooted,
      installDependencies,
    ],
  );

  const runCommand = useCallback(
    async (command: string, args: string[], cwd?: string) => {
      if (!webContainerRef.current) {
        throw new Error("WebContainer not initialized");
      }

      const projectRoot =
        cwd ?? (await getProjectRoot(webContainerRef.current.fs)) ?? "/";

      const process = await webContainerRef.current.spawn(command, args, {
        cwd: projectRoot,
      });

      const reader = process.output.getReader();
      const readOutput = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          writeOutput(value);
        }
      };

      void readOutput();

      return process;
    },
    [webContainerRef],
  );

  const runShellCommand = useCallback(
    async (rawCommand: string, cwd?: string) => {
      if (!webContainerRef.current) {
        throw new Error("WebContainer not initialized");
      }

      const wc = webContainerRef.current;
      const projectRoot = cwd ?? (await getProjectRoot(wc.fs)) ?? "/";
      const segments = splitShellCommandChain(rawCommand);
      if (segments.length === 0) {
        throw new Error("Shell command is empty");
      }

      let exitCode = 0;
      for (const segment of segments) {
        if (devStarted && isDevServerCommand(segment)) {
          writeOutput(`\r\n# skipped (dev server already running): ${segment}\r\n`);
          continue;
        }

        const parsed = parseShellCommand(segment);
        writeOutput(`\r\n$ ${parsed.label}\r\n`);
        exitCode = await runProcess(wc, parsed, projectRoot, writeOutput);
      }

      return exitCode;
    },
    [webContainerRef],
  );

  const writeFile = useCallback(
    async (path: string, content: string) => {
      if (!webContainerRef.current) {
        throw new Error("WebContainer not initialized");
      }

      const normalizedPath = path.startsWith("/") ? path : `/${path}`;
      await webContainerRef.current.fs.writeFile(normalizedPath, content);
    },
    [webContainerRef],
  );

  const readFile = useCallback(
    async (path: string): Promise<string> => {
      if (!webContainerRef.current) {
        throw new Error("WebContainer not initialized");
      }

      const normalizedPath = path.startsWith("/") ? path : `/${path}`;
      return await webContainerRef.current.fs.readFile(normalizedPath, "utf-8");
    },
    [webContainerRef],
  );

  return {
    webContainerRef,
    initializeWebContainer,
    runCommand,
    runShellCommand,
    writeFile,
    readFile,
    setTerminalOutput,
    isContainerBooted,
  };
};
