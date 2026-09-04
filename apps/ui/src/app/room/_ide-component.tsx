"use client";

import React, { useEffect, useRef, useCallback } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, Loader2, FolderPlus } from "lucide-react";
import FolderPreview, { FolderPreviewRef } from "@/components/ide-component/FolderPreview";
import NavBar from "@/components/ide-component/NavBar";
import TerminalComponent from "@/components/ide-component/terminal";
import CodeEditor from "@/components/ide-component/code-editor";
import PreviewFrame from "@/components/ide-component/PreviewFrame";
import { motion, AnimatePresence } from "motion/react";
import { useIDEStore } from "@/stores/ideStore";
import { useTopbar } from "@/hooks/topbar";
import { useExplorer } from "@/hooks/explorer";
import { useKeyShortcutListeners } from "@/hooks/key-shortcut-listners";
import { useWebContainer } from "@/hooks/webcontainer";
import Chat from "@/components/ide-component/Chat";
import ActivityBar from "@/components/ide-component/activity-bar";
import SearchPanel from "@/components/ide-component/SearchPanel";
import type { FileSystemTree } from "@webcontainer/api";
import {
  useWsRtcConnection,
  type CodeFile,
  type CodeSnapshot,
  type CodeSyncEvent,
} from "@/hooks/rtc-ws";
import type { ImperativePanelHandle } from "react-resizable-panels";
import {
  applyOrinActions,
  fileTreeToCodeSnapshot,
  isAutoStartedDevCommand,
  localizeOrinActions,
  normalizeOrinPath,
  parseOrinActions,
  type OrinAction,
} from "@/lib/orin-artifact";
import { consumeProjectPrompt, readProjectPrompt } from "@/lib/initial-prompt";
import { WEBCONTAINER_VITE_DEV_COMMAND } from "@/lib/package-manager";
import { toast } from "sonner";

interface IDEComponentProps {
  projectId?: string;
  initialPrompt?: string;
}

const startedProjectGenerations = new Set<string>();

function normalizeSharedCodeFiles(files: CodeFile[]): CodeFile[] {
  const normalized = new Map<string, string>();

  for (const file of files) {
    const path = normalizeOrinPath(file.path);
    if (!path || typeof file.content !== "string") continue;
    normalized.set(path, file.content);
  }

  return Array.from(normalized, ([path, content]) => ({ path, content }));
}

function normalizeSharedCodeSnapshot(snapshot: CodeSnapshot): CodeSnapshot {
  const directories = new Set<string>();
  for (const directory of snapshot.directories) {
    const path = normalizeOrinPath(directory);
    if (path) directories.add(path);
  }

  return {
    files: normalizeSharedCodeFiles(snapshot.files),
    directories: Array.from(directories),
  };
}

const IDEComponent = ({ projectId, initialPrompt }: IDEComponentProps) => {
  const roomConnection = useWsRtcConnection({ roomId: projectId || "" });
  const {
    sendCodeInit,
    sendCodeSnapshot,
    sendCodeUpdate,
    setCodeEventCallback,
  } = roomConnection;

  const {
    liveUrl,
    activeTab,
    setActiveTab,
    isLoading,
    loadingMessage,
    previewRefreshKey,
    previewDevice,
    setPreviewDevice,
    setFileStructure,
    refreshPreview,
    isContainerBooted,
    setIsLoading,
    setLoadingMessage,
  } = useIDEStore();

  const {
    openTabs,
    setOpenTabs,
    currentTabId,
    setCurrentTabId,
    handleCloseTab,
  } = useTopbar();

  const {
    fileStructure,
    expandedFolders,
    selectedFile,
    toggleFolder,
    setSelectedFile,
    setFileContent,
    handleFileClick,
    handleSaveCurrentFile,
    handleFileContentChange,
    handleCreateFile,
    handleCreateFolder,
    handleDeleteNode,
    handleRenameNode,
    isLoading: isExplorerLoading,
  } = useExplorer({
    projectId,
    currentTabId,
    openTabs,
    setOpenTabs,
    setCurrentTabId,
  });

  const {
    showExplorer,
    setShowExplorer,
    showSearch,
    setShowSearch,
    showTerminal,
    setShowTerminal,
    showAiChat,
    setShowAiChat,
  } = useKeyShortcutListeners({
    handleSaveCurrentFile,
    handleCloseTab,
    currentTabId,
  });

  const folderPreviewRef = useRef<FolderPreviewRef>(null);

  const { initializeWebContainer, webContainerRef, runShellCommand, setTerminalOutput } =
    useWebContainer();

  const devHint = WEBCONTAINER_VITE_DEV_COMMAND.label;

  useEffect(() => {
    if (isExplorerLoading) return;

    initializeWebContainer(fileStructure, projectId).catch((error: unknown) => {
      console.error("[IDE] Failed to initialize WebContainer:", error);
    });
  }, [fileStructure, initializeWebContainer, isExplorerLoading, projectId]);

  const currentTab = openTabs.find((tab) => tab.id === currentTabId);
  const editorSyncTimersRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
  const lastCodeRevisionRef = useRef(0);
  const pendingCodeEventsRef = useRef<CodeSyncEvent[]>([]);
  const remoteCodeApplyRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(
    () => () => {
      for (const timer of editorSyncTimersRef.current.values()) {
        clearTimeout(timer);
      }
      editorSyncTimersRef.current.clear();
    },
    [],
  );

  const applyRemoteCodeActions = useCallback(
    async (actions: OrinAction[]) => {
      if (actions.length === 0) return;

      const webContainer = webContainerRef.current;
      if (webContainer) {
        for (const action of actions) {
          if (action.type === "shell") continue;

          const path = `/${action.path}`;
          try {
            if (action.type === "delete") {
              await webContainer.fs.rm(path, { recursive: true });
              continue;
            }

            if (action.type === "directory") {
              await webContainer.fs.mkdir(path, { recursive: true });
              continue;
            }

            const parentPath = path.slice(0, path.lastIndexOf("/"));
            if (parentPath) {
              await webContainer.fs.mkdir(parentPath, { recursive: true });
            }
            await webContainer.fs.writeFile(path, action.content);
          } catch (error) {
            console.error(`[IDE] Could not apply remote change to ${path}:`, error);
          }
        }
      }

      setFileStructure((previous: FileSystemTree) =>
        applyOrinActions(previous, actions),
      );

      const actionsByPath = new Map(
        actions
          .filter((action) => action.type !== "shell")
          .map((action) => [action.path, action]),
      );
      setOpenTabs((tabs) =>
        tabs.flatMap((tab) => {
          const action = actionsByPath.get(tab.path);
          if (!action) return [tab];
          if (action.type === "delete") return [];
          if (action.type !== "file") return [tab];
          return [{ ...tab, content: action.content, isDirty: false }];
        }),
      );

      if (currentTab && actionsByPath.get(currentTab.path)?.type === "delete") {
        setCurrentTabId(null);
        setSelectedFile(null);
      }

      refreshPreview();
    },
    [
      currentTab,
      refreshPreview,
      setCurrentTabId,
      setFileStructure,
      setOpenTabs,
      setSelectedFile,
      webContainerRef,
    ],
  );

  const enqueueRemoteCodeActions = useCallback(
    (getActions: () => OrinAction[]) => {
      const apply = () => applyRemoteCodeActions(getActions());
      const next = remoteCodeApplyRef.current.then(apply, apply);
      remoteCodeApplyRef.current = next.catch((error: unknown) => {
        console.error("[IDE] Remote code sync failed:", error);
      });
      return next;
    },
    [applyRemoteCodeActions],
  );

  const handleCodeSyncEvent = useCallback(
    (event: CodeSyncEvent) => {
      if (isExplorerLoading) {
        pendingCodeEventsRef.current.push(event);
        return;
      }

      if (event.type === "code-sync-owner" || event.type === "code-sync-request") {
        sendCodeInit(
          fileTreeToCodeSnapshot(useIDEStore.getState().fileStructure),
        );
        return;
      }

      if (event.type === "code-ack") {
        lastCodeRevisionRef.current = Math.max(
          lastCodeRevisionRef.current,
          event.revision,
        );
        return;
      }

      if (event.revision <= lastCodeRevisionRef.current) return;
      lastCodeRevisionRef.current = event.revision;

      if (event.type === "code-update") {
        const path = normalizeOrinPath(event.path);
        if (!path) return;
        void enqueueRemoteCodeActions(() => [
          event.content === null
            ? { type: "delete", path }
            : { type: "file", path, content: event.content },
        ]);
        return;
      }

      const snapshot = normalizeSharedCodeSnapshot(event.snapshot);
      void enqueueRemoteCodeActions(() => {
        const incomingPaths = new Set(snapshot.files.map((file) => file.path));
        const incomingDirectories = new Set(snapshot.directories);
        const currentSnapshot = fileTreeToCodeSnapshot(
          useIDEStore.getState().fileStructure,
        );
        const deletedFiles = currentSnapshot.files
          .filter((file) => !incomingPaths.has(file.path))
          .map((file) => ({ type: "delete" as const, path: file.path }));
        const deletedDirectories = currentSnapshot.directories
          .filter((path) => !incomingDirectories.has(path))
          .map((path) => ({ type: "delete" as const, path }));

        return [
          ...snapshot.directories.map((path) => ({
            type: "directory" as const,
            path,
          })),
          ...snapshot.files.map((file) => ({ type: "file" as const, ...file })),
          ...deletedFiles,
          ...deletedDirectories,
        ];
      });
    },
    [
      enqueueRemoteCodeActions,
      isExplorerLoading,
      sendCodeInit,
    ],
  );

  useEffect(() => {
    if (isExplorerLoading || pendingCodeEventsRef.current.length === 0) return;

    const pendingEvents = pendingCodeEventsRef.current.splice(0);
    for (const event of pendingEvents) void handleCodeSyncEvent(event);
  }, [handleCodeSyncEvent, isExplorerLoading]);

  useEffect(() => {
    setCodeEventCallback(handleCodeSyncEvent);
    return () => setCodeEventCallback(null);
  }, [handleCodeSyncEvent, setCodeEventCallback]);

  const handleEditorChange = useCallback(
    (content: string) => {
      if (!currentTabId || !currentTab) return;

      handleFileContentChange(currentTabId, content);
      setFileContent(currentTab.path, content);

      const syncPath = currentTab.path;
      const previousTimer = editorSyncTimersRef.current.get(syncPath);
      if (previousTimer) {
        clearTimeout(previousTimer);
      }

      const timer = setTimeout(() => {
        editorSyncTimersRef.current.delete(syncPath);
        sendCodeUpdate(syncPath, content);

        const webContainer = webContainerRef.current;
        if (!webContainer) return;

        webContainer.fs
          .writeFile(`/${syncPath}`, content)
          .then(() => refreshPreview())
          .catch((error: unknown) => {
            console.error("[IDE] Could not sync the edited file:", error);
          });
      }, 400);
      editorSyncTimersRef.current.set(syncPath, timer);
    },
    [
      currentTab,
      currentTabId,
      handleFileContentChange,
      refreshPreview,
      sendCodeUpdate,
      setFileContent,
      webContainerRef,
    ],
  );

  const applyGeneratedActions = useCallback(
    async (actions: OrinAction[]) => {
      const currentTree = useIDEStore.getState().fileStructure;
      const localized = localizeOrinActions(actions, currentTree);
      const webContainer = webContainerRef.current;
      if (webContainer) {
        for (const action of localized) {
          if (action.type === "shell") continue;

          const path = `/${action.path}`;

          if (action.type === "delete") {
            try {
              await webContainer.fs.rm(path, { recursive: true });
            } catch {
              // The project tree remains the source of truth if the container is behind.
            }
            continue;
          }

          if (action.type === "directory") {
            await webContainer.fs.mkdir(path, { recursive: true });
            continue;
          }

          const parentPath = path.slice(0, path.lastIndexOf("/"));
          if (parentPath) {
            await webContainer.fs.mkdir(parentPath, { recursive: true });
          }
          await webContainer.fs.writeFile(path, action.content);
        }
      }

      setFileStructure((previous: FileSystemTree) =>
        applyOrinActions(previous, localizeOrinActions(actions, previous)),
      );

      for (const action of localized) {
        if (action.type !== "shell") continue;
        if (isAutoStartedDevCommand(action.command)) continue;
        try {
          await runShellCommand(action.command);
        } catch (error) {
          console.error("[IDE] Shell action failed:", error);
          throw error instanceof Error
            ? error
            : new Error(`Failed to run "${action.command}"`);
        }
      }

      const finalActionsByPath = new Map(
        localized
          .filter((action) => action.type !== "shell")
          .map((action) => [action.path, action]),
      );
      setOpenTabs((tabs) =>
        tabs.flatMap((tab) => {
          const action = finalActionsByPath.get(tab.path);
          if (!action) return [tab];
          if (action.type === "delete") return [];
          if (action.type !== "file") return [tab];
          return [{ ...tab, content: action.content, isDirty: false }];
        }),
      );

      if (
        currentTab &&
        finalActionsByPath.get(currentTab.path)?.type === "delete"
      ) {
        setCurrentTabId(null);
        setSelectedFile(null);
      }

      sendCodeSnapshot(
        fileTreeToCodeSnapshot(useIDEStore.getState().fileStructure),
      );
      refreshPreview();
    },
    [
      currentTab,
      refreshPreview,
      runShellCommand,
      sendCodeSnapshot,
      setCurrentTabId,
      setFileStructure,
      setOpenTabs,
      setSelectedFile,
      webContainerRef,
    ],
  );

  const broadcastCodeSnapshot = useCallback(() => {
    sendCodeSnapshot(
      fileTreeToCodeSnapshot(useIDEStore.getState().fileStructure),
    );
  }, [sendCodeSnapshot]);

  const handleCreateFileAndShare = useCallback(
    async (path: string, content = "") => {
      await handleCreateFile(path, content);
      broadcastCodeSnapshot();
    },
    [broadcastCodeSnapshot, handleCreateFile],
  );

  const handleCreateFolderAndShare = useCallback(
    async (path: string) => {
      await handleCreateFolder(path);
      broadcastCodeSnapshot();
    },
    [broadcastCodeSnapshot, handleCreateFolder],
  );

  const handleDeleteNodeAndShare = useCallback(
    async (path: string) => {
      await handleDeleteNode(path);
      broadcastCodeSnapshot();
    },
    [broadcastCodeSnapshot, handleDeleteNode],
  );

  const handleRenameNodeAndShare = useCallback(
    async (oldPath: string, newPath: string) => {
      await handleRenameNode(oldPath, newPath);
      broadcastCodeSnapshot();
    },
    [broadcastCodeSnapshot, handleRenameNode],
  );

  useEffect(() => {
    if (!projectId || isExplorerLoading || !isContainerBooted) return;
    if (startedProjectGenerations.has(projectId)) return;

    const prompt = initialPrompt || readProjectPrompt(projectId);
    if (!prompt) return;

    startedProjectGenerations.add(projectId);

    void (async () => {
      try {
        setIsLoading(true);
        setLoadingMessage("Generating your app...");
        const response = await fetch("/api/orin/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt }),
        });
        const payload = (await response.json().catch(() => ({}))) as {
          response?: string;
          error?: string;
        };

        if (!response.ok || !payload.response) {
          throw new Error(payload.error || "The Orin backend could not generate the app.");
        }

        const actions = parseOrinActions(payload.response);
        if (actions.length > 0) {
          await applyGeneratedActions(actions);
          toast.success("App generated");
        } else {
          toast.info("The model replied without file changes. Try the chat panel.");
        }
        consumeProjectPrompt(projectId);
      } catch (error) {
        startedProjectGenerations.delete(projectId);
        const message =
          error instanceof Error ? error.message : "App generation failed";
        console.error("[IDE] Initial generate failed:", error);
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [
    applyGeneratedActions,
    initialPrompt,
    isContainerBooted,
    isExplorerLoading,
    projectId,
    setIsLoading,
    setLoadingMessage,
  ]);

  // Refs for imperative panel control
  const explorerPanelRef = useRef<ImperativePanelHandle>(null);
  const terminalPanelRef = useRef<ImperativePanelHandle>(null);
  const aiChatPanelRef = useRef<ImperativePanelHandle>(null);

  // Sync panel collapse/expand with state
  useEffect(() => {
    const panel = explorerPanelRef.current;
    if (!panel) return;
    if (showExplorer || showSearch) {
      if (panel.isCollapsed()) panel.expand();
    } else {
      if (!panel.isCollapsed()) panel.collapse();
    }
  }, [showExplorer, showSearch]);

  useEffect(() => {
    const panel = terminalPanelRef.current;
    if (!panel) return;
    if (showTerminal) {
      if (panel.isCollapsed()) panel.expand();
    } else {
      if (!panel.isCollapsed()) panel.collapse();
    }
  }, [showTerminal]);

  useEffect(() => {
    const panel = aiChatPanelRef.current;
    if (!panel) return;
    if (showAiChat) {
      if (panel.isCollapsed()) panel.expand();
    } else {
      if (!panel.isCollapsed()) panel.collapse();
    }
  }, [showAiChat]);

  return (
    <TooltipProvider>
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{loadingMessage}</p>
          </div>
        </div>
      )}
      <div className="flex h-screen overflow-hidden bg-background">
        <ActivityBar
          showExplorer={showExplorer}
          setShowExplorer={setShowExplorer}
          showSearch={showSearch}
          setShowSearch={setShowSearch}
          showTerminal={showTerminal}
          setShowTerminal={setShowTerminal}
          showAiChat={showAiChat}
          setShowAiChat={setShowAiChat}
        />

        <ResizablePanelGroup direction="horizontal" className="h-full min-w-0 flex-1">
          <ResizablePanel
            ref={explorerPanelRef}
            defaultSize={showExplorer || showSearch ? 20 : 0}
            minSize={15}
            maxSize={40}
            collapsible={true}
            collapsedSize={0}
            onCollapse={() => {
              if (showExplorer) setShowExplorer(false);
              if (showSearch) setShowSearch(false);
            }}
            onExpand={() => {
              if (!showExplorer && !showSearch) setShowExplorer(true);
            }}
          >
            <div className="flex h-full flex-col bg-sidebar">
              {showSearch ? (
                <SearchPanel
                  fileStructure={fileStructure}
                  onFileClick={handleFileClick}
                />
              ) : (
                <>
                  <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/60">
                      Explorer
                    </span>
                    <div className="flex gap-0.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 text-muted-foreground hover:text-foreground"
                            onClick={() =>
                              folderPreviewRef.current?.startNewFile()
                            }
                          >
                            <Plus className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>New File</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 text-muted-foreground hover:text-foreground"
                            onClick={() =>
                              folderPreviewRef.current?.startNewFolder()
                            }
                          >
                            <FolderPlus className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>New Folder</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  <FolderPreview
                    ref={folderPreviewRef}
                    fileStructure={fileStructure}
                    expandedFolders={expandedFolders}
                    selectedFile={selectedFile}
                    onToggleFolder={toggleFolder}
                    onFileClick={handleFileClick}
                    onCreateFile={handleCreateFileAndShare}
                    onCreateFolder={handleCreateFolderAndShare}
                    onDeleteNode={handleDeleteNodeAndShare}
                    onRenameNode={handleRenameNodeAndShare}
                  />
                </>
              )}
            </div>
          </ResizablePanel>
          <ResizableHandle />

          <ResizablePanel
            className="h-full min-w-0"
            defaultSize={showAiChat ? 50 : 60}
          >
            <div className="flex h-full min-h-0 flex-col">
              <NavBar
                openTabs={openTabs}
                currentTabId={currentTabId}
                setCurrentTabId={setCurrentTabId}
                handleCloseTab={handleCloseTab}
                showAiChat={showAiChat}
                setShowAiChat={setShowAiChat}
                showExplorer={showExplorer}
                setShowExplorer={setShowExplorer}
                showTerminal={showTerminal}
                setShowTerminal={setShowTerminal}
                handleSaveCurrentFile={handleSaveCurrentFile}
                liveUrl={liveUrl}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                previewDevice={previewDevice}
                setPreviewDevice={setPreviewDevice}
                fileStructure={fileStructure}
                projectName={projectId ? "Orin project" : "New Orin project"}
              />

              <ResizablePanelGroup direction="vertical" className="min-h-0 flex-1">
                <ResizablePanel defaultSize={showTerminal ? 72 : 100} minSize={30}>
                  <div className="relative h-full overflow-hidden bg-background">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeTab}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="h-full w-full"
                      >
                        {activeTab === "preview" ? (
                          liveUrl ? (
                            <PreviewFrame
                              url={liveUrl}
                              device={previewDevice}
                              refreshKey={previewRefreshKey}
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center bg-background">
                              <div className="text-center">
                                <h3 className="mb-1 text-sm font-medium">
                                  Server Not Running
                                </h3>
                                <p className="mb-3 text-xs text-muted-foreground">
                                  Dependencies install automatically on open. Run this in the terminal:
                                </p>
                                <pre className="text-left font-mono text-xs text-muted-foreground">
                                  {devHint}
                                </pre>
                              </div>
                            </div>
                          )
                        ) : currentTab ? (
                          <div className="relative h-full">
                            <CodeEditor
                              key={currentTab.id}
                              fileContent={currentTab.content}
                              filePath={currentTab.path}
                              onChange={handleEditorChange}
                            />
                          </div>
                        ) : (
                          <div className="relative flex h-full items-center justify-center bg-background">
                            <div className="z-10 text-center">
                              <h3 className="mb-1 text-sm font-medium">
                                No File Open
                              </h3>
                              <p className="text-xs text-muted-foreground">
                                Select a file from the explorer to start
                                editing
                              </p>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel
                  ref={terminalPanelRef}
                  defaultSize={showTerminal ? 28 : 0}
                  minSize={15}
                  maxSize={60}
                  collapsible={true}
                  collapsedSize={0}
                  onCollapse={() => {
                    if (showTerminal) setShowTerminal(false);
                  }}
                  onExpand={() => {
                    if (!showTerminal) setShowTerminal(true);
                  }}
                >
                  <TerminalComponent
                    onClose={() => setShowTerminal(false)}
                    onMaximize={() => terminalPanelRef.current?.resize(60)}
                    onReady={setTerminalOutput}
                  />
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          </ResizablePanel>

          <ResizableHandle />
          <ResizablePanel
            ref={aiChatPanelRef}
            defaultSize={showAiChat ? 25 : 0}
            minSize={15}
            maxSize={40}
            collapsible={true}
            collapsedSize={0}
            onCollapse={() => {
              if (showAiChat) setShowAiChat(false);
            }}
            onExpand={() => {
              if (!showAiChat) setShowAiChat(true);
            }}
          >
            <Chat
              onClose={() => setShowAiChat(false)}
              projectId={projectId}
              roomConnection={roomConnection}
              fileStructure={fileStructure}
              onActionsGenerated={applyGeneratedActions}
              runtimeReady={isContainerBooted}
              currentFile={
                currentTab
                  ? { name: currentTab.name, path: currentTab.path }
                  : null
              }
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </TooltipProvider>
  );
};

export default IDEComponent;
