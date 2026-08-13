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
import { useWsRtcConnection } from "@/hooks/rtc-ws";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { applyOrinActions, type OrinAction } from "@/lib/orin-artifact";

interface IDEComponentProps {
  projectId?: string;
  initialPrompt?: string;
}

const IDEComponent = ({ projectId }: IDEComponentProps) => {
  const roomConnection = useWsRtcConnection({ roomId: projectId || "" });

  console.log("Fetched project data:", projectId);

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

  const { initializeWebContainer, webContainerRef } = useWebContainer();

  useEffect(() => {
    if (isExplorerLoading) return;

    initializeWebContainer(fileStructure).catch((error: unknown) => {
      console.error("[IDE] Failed to initialize WebContainer:", error);
    });
  }, [fileStructure, initializeWebContainer, isExplorerLoading]);

  // Teardown WebContainer only on unmount
  useEffect(() => {
    return () => {
      if (webContainerRef.current) {
        try {
          webContainerRef.current.teardown();
        } catch (e) {
          console.warn("WebContainer teardown failed:", e);
        }
      }
    };
  }, []);

  const currentTab = openTabs.find((tab) => tab.id === currentTabId);
  const editorSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (editorSyncTimerRef.current) {
        clearTimeout(editorSyncTimerRef.current);
      }
    },
    [],
  );

  const handleEditorChange = useCallback(
    (content: string) => {
      if (!currentTabId || !currentTab) return;

      handleFileContentChange(currentTabId, content);
      setFileContent(currentTab.path, content);

      if (editorSyncTimerRef.current) {
        clearTimeout(editorSyncTimerRef.current);
      }

      editorSyncTimerRef.current = setTimeout(() => {
        const webContainer = webContainerRef.current;
        if (!webContainer) return;

        webContainer.fs
          .writeFile(`/${currentTab.path}`, content)
          .then(() => refreshPreview())
          .catch((error: unknown) => {
            console.error("[IDE] Could not sync the edited file:", error);
          });
      }, 400);
    },
    [currentTab, currentTabId, handleFileContentChange, refreshPreview, setFileContent, webContainerRef],
  );

  const applyGeneratedActions = useCallback(
    async (actions: OrinAction[]) => {
      const webContainer = webContainerRef.current;
      if (webContainer) {
        for (const action of actions) {
          const path = `/${action.path}`;

          if (action.type === "delete") {
            try {
              await webContainer.fs.rm(path);
            } catch {
              // The project tree remains the source of truth if the container is behind.
            }
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
        applyOrinActions(previous, actions),
      );

      const finalActionsByPath = new Map(actions.map((action) => [action.path, action]));
      setOpenTabs((tabs) =>
        tabs.flatMap((tab) => {
          const action = finalActionsByPath.get(tab.path);
          if (!action) return [tab];
          if (action.type === "delete") return [];
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

      refreshPreview();
    },
    [currentTab, refreshPreview, setCurrentTabId, setFileStructure, setOpenTabs, setSelectedFile, webContainerRef],
  );

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

  if (isLoading) {
    return (
      <div className="h-screen overflow-hidden w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{loadingMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="h-screen flex-1">
        <div className="flex-1 flex flex-col h-full">
          <ResizablePanelGroup direction="horizontal" className="h-full">
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
              <div className="h-full bg-muted/30 flex flex-col">
                {showSearch ? (
                  <SearchPanel
                    fileStructure={fileStructure}
                    onFileClick={handleFileClick}
                  />
                ) : (
                  <>
                    <div className="px-4 py-3 font-semibold text-sm border-b flex items-center justify-between">
                      <span>Explorer</span>
                      <div className="flex gap-0.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() =>
                                folderPreviewRef.current?.startNewFile()
                              }
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>New File</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() =>
                                folderPreviewRef.current?.startNewFolder()
                              }
                            >
                              <FolderPlus className="h-3.5 w-3.5" />
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
                      onCreateFile={handleCreateFile}
                      onCreateFolder={handleCreateFolder}
                      onDeleteNode={handleDeleteNode}
                      onRenameNode={handleRenameNode}
                    />
                  </>
                )}
              </div>
            </ResizablePanel>
            <ResizableHandle />

            <ResizablePanel
              className="h-full"
              defaultSize={showAiChat ? 50 : 60}
            >
              <div className="h-full flex flex-col">
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

                <div className="flex flex-col flex-1 overflow-hidden">
                  <div className="flex-1 overflow-hidden">
                    <div className="h-full overflow-hidden relative">
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
                              <div className="flex items-center justify-center h-full">
                                <div className="text-center">
                                  <h3 className="text-lg font-semibold mb-1">
                                    Server Not Running
                                  </h3>
                                  <p className="text-sm text-muted-foreground mb-4">
                                    Run these commands in the terminal:
                                  </p>
                                  <pre className="bg-muted p-4 rounded-lg text-left text-sm">
                                    npm install{"\n"}
                                    npm run dev
                                  </pre>
                                </div>
                              </div>
                            )
                          ) : currentTab ? (
                            <div className="h-full relative">
                              <CodeEditor
                                key={currentTab.id}
                                fileContent={currentTab.content}
                                filePath={currentTab.path}
                                onChange={handleEditorChange}
                              />
                            </div>
                          ) : (
                            <div className="flex items-center justify-center h-full relative">
                              <div className="text-center z-10">
                                <h3 className="text-lg font-semibold mb-2">
                                  No File Open
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                  Select a file from the explorer to start
                                  editing
                                </p>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </div>

                  <div className={`h-[220px] border-t border-border shrink-0 ${!showTerminal ? "hidden" : ""}`}>
                    <TerminalComponent />
                  </div>
                </div>
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
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default IDEComponent;
