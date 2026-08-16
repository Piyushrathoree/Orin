import { useIDEStore } from "@/stores/ideStore";
import {
  detectPackageManager,
  getInstallCommand,
  getProjectRoot,
  needsInstall,
  parseShellCommand,
  type PackageCommand,
} from "@/lib/package-manager";
import { WebContainer, FileSystemTree } from "@webcontainer/api";
import { useCallback, useRef } from "react";
import { toast } from "sonner";

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

  const containerBooted = useRef(false);
  const terminalOutputRef = useRef<((data: string) => void) | null>(null);

  const setTerminalOutput = useCallback((callback: (data: string) => void) => {
    terminalOutputRef.current = callback;
  }, []);

  const writeOutput = useCallback((data: string) => {
    terminalOutputRef.current?.(data);
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
      await runProcess(wc, installCommand, projectRoot, writeOutput);
      toast.success("Dependencies installed");
    },
    [setLoadingMessage, writeOutput],
  );

  const initializeWebContainer = useCallback(
    async (fileTree: FileSystemTree) => {
      if (containerBooted.current || webContainerRef.current) {
        return webContainerRef.current;
      }

      containerBooted.current = true;

      try {
        setContainerError(null);
        setLoadingMessage("Booting Container...");
        const wc = await WebContainer.boot();
        webContainerRef.current = wc;

        setLoadingMessage("Mounting project files...");

        if (fileTree) {
          await wc.mount(fileTree);
          toast.success("Project files loaded successfully! 🚀");
        } else {
          toast.error(
            "Failed to load project files. Starting with an empty file system.",
          );
        }

        wc.on("server-ready", (port, url) => {
          setLiveUrl(url);
          toast.success(`Server running on port ${port} 🚀`);
        });

        const projectRoot = await getProjectRoot(wc.fs);
        if (projectRoot) {
          await installDependencies(wc, projectRoot);
        }

        setIsContainerBooted(true);
        setIsLoading(false);

        return wc;
      } catch (error) {
        console.error("WebContainer error:", error);
        const message =
          error instanceof Error ? error.message : "Unknown WebContainer error";
        setContainerError(message);
        setIsContainerBooted(false);
        toast.error(`Failed to start WebContainer: ${message}`);
        containerBooted.current = false;
        webContainerRef.current = null;
        setIsLoading(false);
        throw error;
      }
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

  const teardownWebContainer = useCallback(() => {
    if (webContainerRef.current) {
      try {
        webContainerRef.current.teardown();
      } catch (error) {
        console.warn("WebContainer teardown failed:", error);
      }
      webContainerRef.current = null;
    }

    containerBooted.current = false;
    setIsContainerBooted(false);
    setLiveUrl(null);
  }, [setIsContainerBooted, setLiveUrl, webContainerRef]);

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

      readOutput();

      return process;
    },
    [webContainerRef, writeOutput],
  );

  const runShellCommand = useCallback(
    async (rawCommand: string, cwd?: string) => {
      if (!webContainerRef.current) {
        throw new Error("WebContainer not initialized");
      }

      const wc = webContainerRef.current;
      const projectRoot = cwd ?? (await getProjectRoot(wc.fs)) ?? "/";
      const parsed = parseShellCommand(rawCommand);

      return runProcess(wc, parsed, projectRoot, writeOutput);
    },
    [webContainerRef, writeOutput],
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
    teardownWebContainer,
    runCommand,
    runShellCommand,
    writeFile,
    readFile,
    setTerminalOutput,
    isContainerBooted,
  };
};
