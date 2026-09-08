import { useIDEStore } from "@/stores/ideStore";
import { useEffect, useState } from "react";

export const useKeyShortcutListeners = ({
  handleSaveCurrentFile,
  handleUndo,
  handleRedo,
  handleCloseTab,
  currentTabId,
}: {
  handleSaveCurrentFile: () => void;
  handleUndo: () => void;
  handleRedo: () => void;
  handleCloseTab: (tabId: string) => void;
  currentTabId: string | null;
}) => {
  // Sidebar State
  const [showExplorer, setShowExplorer] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [showAiChat, setShowAiChat] = useState(true);
  const [showTerminal, setShowTerminal] = useState(true);
  const { setActiveTab } = useIDEStore();
  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + B - Toggle Explorer
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        setShowExplorer((prev) => !prev);
        if (showSearch) setShowSearch(false);
      }

      // Ctrl/Cmd + Shift + F - Toggle Search
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "F") {
        e.preventDefault();
        setShowSearch((prev) => !prev);
        if (showExplorer) setShowExplorer(false);
      }

      // Ctrl/Cmd + ` - Toggle Terminal
      if ((e.ctrlKey || e.metaKey) && e.key === "`") {
        e.preventDefault();
        setShowTerminal((prev) => !prev);
      }

      // Ctrl/Cmd + Shift + E - Toggle Explorer
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "E") {
        e.preventDefault();
        setShowExplorer((prev) => !prev);
        if (showSearch) setShowSearch(false);
      }

      // Ctrl/Cmd + Shift + A - Toggle AI Chat
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "A") {
        e.preventDefault();
        setShowAiChat((prev) => !prev);
      }

      // Ctrl/Cmd + Shift + P - Preview
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "P") {
        e.preventDefault();
        setActiveTab("preview");
      }

      // Ctrl/Cmd + Shift + C - Code
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "C") {
        e.preventDefault();
        setActiveTab("code");
      }

      // Ctrl/Cmd + S - Save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSaveCurrentFile();
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      }

      // Ctrl/Cmd + W - Close Tab
      if ((e.ctrlKey || e.metaKey) && e.key === "w") {
        e.preventDefault();
        if (currentTabId) {
          handleCloseTab(currentTabId);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    currentTabId,
    handleCloseTab,
    handleRedo,
    handleSaveCurrentFile,
    handleUndo,
    setActiveTab,
    showExplorer,
    showSearch,
  ]);

  return {
    setShowTerminal,
    setShowExplorer,
    setShowSearch,
    setShowAiChat,
    showExplorer,
    showSearch,
    showTerminal,
    showAiChat,
  };
};
