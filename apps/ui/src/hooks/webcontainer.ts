import { useIDEStore } from "@/stores/ideStore";
import { WebContainer, FileSystemTree } from "@webcontainer/api";
import { useCallback, useRef } from "react";
import { toast } from "sonner";

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
          toast.success("Project files loaded successfully! 🚀");
          await wc.mount(fileTree);
        } else {
          toast.error(
            "Failed to load project files. Starting with an empty file system.",
          );
        }

        wc.on("server-ready", (port, url) => {
          setLiveUrl(url);
          toast.success(`Server running on port ${port} 🚀`);
        });

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
    ],
  );

  const runCommand = useCallback(
    async (command: string, args: string[], cwd?: string) => {
      if (!webContainerRef.current) {
        throw new Error("WebContainer not initialized");
      }

      const process = await webContainerRef.current.spawn(command, args, {
        cwd: cwd || "/vanilla-web-app",
      });

      const reader = process.output.getReader();
      const readOutput = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (terminalOutputRef.current) {
            terminalOutputRef.current(value);
          }
        }
      };

      readOutput();

      return process;
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
    writeFile,
    readFile,
    setTerminalOutput,
    isContainerBooted,
  };
};
