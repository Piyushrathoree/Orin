import { useIDEStore } from "@/stores/ideStore";
import type { FileSystemTree } from "@webcontainer/api";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  DEFAULT_PROJECT_NAME,
  getDefaultExpandedFolders,
  getLegacyProjectStorageKey,
  getPreviousProjectStorageKey,
  getProjectStorageKey,
  resolveProjectTree,
  sanitizeProjectName,
  TEMPLATE_VERSION_STORAGE_KEY,
  PROJECT_TEMPLATE_VERSION,
} from "@/data/project-file";
import type { TabInfo } from "./topbar";

const PROJECTS_STORAGE_KEY = "orin:projects";

function readProjectTree(key: string): FileSystemTree | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as FileSystemTree) : null;
  } catch (error) {
    console.warn("[Orin UI] Could not read the local project:", error);
    return null;
  }
}

function readFolderNameForProject(projectId?: string): string {
  if (!projectId || typeof window === "undefined") return DEFAULT_PROJECT_NAME;

  try {
    const stored = window.localStorage.getItem(PROJECTS_STORAGE_KEY);
    const parsed = stored ? (JSON.parse(stored) as unknown) : [];
    const projects = Array.isArray(parsed)
      ? (parsed as Array<{ id?: string; name?: string }>)
      : [];
    const match = projects.find((project) => project.id === projectId);
    return sanitizeProjectName(match?.name ?? DEFAULT_PROJECT_NAME);
  } catch {
    return DEFAULT_PROJECT_NAME;
  }
}

function writeProjectTree(key: string, tree: FileSystemTree) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(tree));
  } catch (error) {
    console.warn("[Orin UI] Could not save the local project:", error);
  }
}

function normalizePath(path: string) {
  return path.replace(/^\/+|\/+$/g, "");
}

function getNodeAtPath(tree: FileSystemTree, path: string) {
  const parts = normalizePath(path).split("/").filter(Boolean);
  let current = tree;

  for (const [index, part] of parts.entries()) {
    const node = current[part];
    if (!node) return undefined;
    if (index === parts.length - 1) return node;
    if (!("directory" in node)) return undefined;
    current = node.directory;
  }

  return undefined;
}

function setNodeAtPath(
  tree: FileSystemTree,
  path: string,
  node: NonNullable<ReturnType<typeof getNodeAtPath>>,
) {
  const parts = normalizePath(path).split("/").filter(Boolean);
  if (parts.length === 0) return tree;

  const update = (current: FileSystemTree, index: number): FileSystemTree => {
    const part = parts[index];
    if (index === parts.length - 1) {
      return { ...current, [part]: node };
    }

    const existing = current[part];
    const child = existing && "directory" in existing ? existing.directory : {};
    return {
      ...current,
      [part]: { directory: update(child, index + 1) },
    };
  };

  return update(tree, 0);
}

function removeNodeAtPath(tree: FileSystemTree, path: string) {
  const parts = normalizePath(path).split("/").filter(Boolean);
  if (parts.length === 0) return tree;

  const update = (current: FileSystemTree, index: number): FileSystemTree => {
    const part = parts[index];
    if (!current[part]) return current;

    if (index === parts.length - 1) {
      const next = { ...current };
      delete next[part];
      return next;
    }

    const existing = current[part];
    if (!("directory" in existing)) return current;

    return {
      ...current,
      [part]: { directory: update(existing.directory, index + 1) },
    };
  };

  return update(tree, 0);
}

function nodeContent(node: NonNullable<ReturnType<typeof getNodeAtPath>>) {
  if (!("file" in node)) return "";
  if (typeof node.file === "string") return node.file;
  return "contents" in node.file
    ? typeof node.file.contents === "string"
      ? node.file.contents
      : new TextDecoder().decode(node.file.contents)
    : "";
}

export const useExplorer = ({
  projectId,
  currentTabId,
  openTabs,
  setOpenTabs,
  setCurrentTabId,
}: {
  projectId?: string;
  currentTabId: string | null;
  openTabs: TabInfo[];
  setOpenTabs: (tabs: TabInfo[] | ((prev: TabInfo[]) => TabInfo[])) => void;
  setCurrentTabId: (id: string | null) => void;
}) => {
  const {
    fileStructure,
    setFileStructure,
    setActiveTab,
    refreshPreview,
  } = useIDEStore();
  const projectKey = getProjectStorageKey(projectId);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    () => getDefaultExpandedFolders(fileStructure),
  );
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  useEffect(() => {
    const currentTree = readProjectTree(projectKey);
    const previousKey = getPreviousProjectStorageKey(projectId);
    const previousTree = currentTree ? null : readProjectTree(previousKey);
    const legacyKey = getLegacyProjectStorageKey(projectId);
    const legacyTree =
      currentTree || previousTree ? null : readProjectTree(legacyKey);
    const savedTree = currentTree ?? previousTree ?? legacyTree;
    // Hydrate the shared editor store from browser storage after mounting.
    /* eslint-disable react-hooks/set-state-in-effect */
    const tree = resolveProjectTree(
      savedTree,
      readFolderNameForProject(projectId),
    );
    setFileStructure(tree);
    setExpandedFolders(getDefaultExpandedFolders(tree));
    setOpenTabs([]);
    setCurrentTabId(null);
    setSelectedFile(null);
    setStorageLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */

    try {
      window.localStorage.setItem(
        TEMPLATE_VERSION_STORAGE_KEY,
        String(PROJECT_TEMPLATE_VERSION),
      );
      window.localStorage.removeItem(legacyKey);
      window.localStorage.removeItem(previousKey);
      writeProjectTree(projectKey, tree);
    } catch {
      // Persistence is best-effort; the in-memory Vite tree still boots.
    }
  }, [projectId, projectKey, setCurrentTabId, setFileStructure, setOpenTabs]);

  useEffect(() => {
    if (storageLoaded) writeProjectTree(projectKey, fileStructure);
  }, [fileStructure, projectKey, storageLoaded]);

  const toggleFolder = useCallback((folderName: string) => {
    setExpandedFolders((previous) => {
      const next = new Set(previous);
      if (next.has(folderName)) next.delete(folderName);
      else next.add(folderName);
      return next;
    });
  }, []);

  const getFileContent = useCallback(
    (path: string) => {
      const node = getNodeAtPath(fileStructure, path);
      return node ? nodeContent(node) : "";
    },
    [fileStructure],
  );

  const setFileContent = useCallback(
    (path: string, content: string) => {
      setFileStructure((previous: FileSystemTree) =>
        setNodeAtPath(previous, path, { file: { contents: content } }),
      );
    },
    [setFileStructure],
  );

  const handleSaveCurrentFile = useCallback(async () => {
    if (!currentTabId) return;

    const currentTab = openTabs.find((tab) => tab.id === currentTabId);
    if (!currentTab) return;

    const { editorView, webContainerRef } = useIDEStore.getState();
    const content = editorView?.state.doc.toString() ?? currentTab.content;
    const saveToast = toast.loading(`Saving ${currentTab.name}...`);

    try {
      if (webContainerRef.current) {
        await webContainerRef.current.fs.writeFile(`/${normalizePath(currentTab.path)}`, content);
      }

      setFileContent(currentTab.path, content);
      setOpenTabs((tabs) =>
        tabs.map((tab) =>
          tab.id === currentTabId
            ? { ...tab, isDirty: false, content }
            : tab,
        ),
      );
      refreshPreview();
      toast.success(`Saved ${currentTab.name}`, { id: saveToast });
    } catch (error) {
      console.error("[Orin UI] Save failed:", error);
      toast.error("Failed to save file", { id: saveToast });
    }
  }, [currentTabId, openTabs, refreshPreview, setFileContent, setOpenTabs]);

  const handleFileClick = useCallback(
    (path: string, name: string) => {
      const normalizedPath = normalizePath(path);
      const existingTab = openTabs.find((tab) => tab.path === normalizedPath);

      if (existingTab) {
        setCurrentTabId(existingTab.id);
      } else {
        const newTab: TabInfo = {
          id: `tab-${Date.now()}`,
          name,
          path: normalizedPath,
          isDirty: false,
          content: getFileContent(normalizedPath),
        };
        setOpenTabs([...openTabs, newTab]);
        setCurrentTabId(newTab.id);
      }

      setSelectedFile(normalizedPath);
      setActiveTab("code");
    },
    [getFileContent, openTabs, setActiveTab, setCurrentTabId, setOpenTabs],
  );

  const handleFileContentChange = useCallback(
    (tabId: string, newContent: string) => {
      setOpenTabs((tabs) =>
        tabs.map((tab) =>
          tab.id === tabId
            ? { ...tab, content: newContent, isDirty: true }
            : tab,
        ),
      );
    },
    [setOpenTabs],
  );

  const handleCreateFile = useCallback(
    async (path: string, content = "") => {
      const normalizedPath = normalizePath(path);
      setFileStructure((previous: FileSystemTree) =>
        setNodeAtPath(previous, normalizedPath, { file: { contents: content } }),
      );

      const webContainer = useIDEStore.getState().webContainerRef.current;
      if (webContainer) {
        const webPath = `/${normalizedPath}`;
        const parentPath = webPath.slice(0, webPath.lastIndexOf("/"));
        if (parentPath) await webContainer.fs.mkdir(parentPath, { recursive: true });
        await webContainer.fs.writeFile(webPath, content);
      }

      toast.success(`Created ${normalizedPath.split("/").pop()}`);
    },
    [setFileStructure],
  );

  const handleCreateFolder = useCallback(
    async (path: string) => {
      const normalizedPath = normalizePath(path);
      setFileStructure((previous: FileSystemTree) =>
        setNodeAtPath(previous, normalizedPath, { directory: {} }),
      );

      const webContainer = useIDEStore.getState().webContainerRef.current;
      if (webContainer) {
        await webContainer.fs.mkdir(`/${normalizedPath}`, { recursive: true });
      }
      toast.success(`Created folder ${normalizedPath.split("/").pop()}`);
    },
    [setFileStructure],
  );

  const handleDeleteNode = useCallback(
    async (path: string) => {
      const normalizedPath = normalizePath(path);
      setFileStructure((previous: FileSystemTree) =>
        removeNodeAtPath(previous, normalizedPath),
      );

      const webContainer = useIDEStore.getState().webContainerRef.current;
      if (webContainer) {
        try {
          await webContainer.fs.rm(`/${normalizedPath}`, { recursive: true });
        } catch {
          // The file may already have been removed from the container.
        }
      }

      setOpenTabs((tabs) =>
        tabs.filter(
          (tab) =>
            tab.path !== normalizedPath &&
            !tab.path.startsWith(`${normalizedPath}/`),
        ),
      );
      toast.success(`Deleted ${normalizedPath.split("/").pop()}`);
    },
    [setFileStructure, setOpenTabs],
  );

  const handleRenameNode = useCallback(
    async (oldPath: string, newPath: string) => {
      const normalizedOldPath = normalizePath(oldPath);
      const normalizedNewPath = normalizePath(newPath);
      const node = getNodeAtPath(fileStructure, normalizedOldPath);
      if (!node || !normalizedNewPath) return;

      setFileStructure((previous: FileSystemTree) =>
        setNodeAtPath(
          removeNodeAtPath(previous, normalizedOldPath),
          normalizedNewPath,
          node,
        ),
      );

      const webContainer = useIDEStore.getState().webContainerRef.current;
      if (webContainer) {
        try {
          await webContainer.fs.rename(
            `/${normalizedOldPath}`,
            `/${normalizedNewPath}`,
          );
        } catch {
          // Keep the local tree usable if the container has not caught up yet.
        }
      }

      setOpenTabs((tabs) =>
        tabs.map((tab) => {
          if (
            tab.path !== normalizedOldPath &&
            !tab.path.startsWith(`${normalizedOldPath}/`)
          ) {
            return tab;
          }

          const updatedPath = tab.path.replace(
            normalizedOldPath,
            normalizedNewPath,
          );
          return {
            ...tab,
            path: updatedPath,
            name: updatedPath.split("/").pop() || tab.name,
          };
        }),
      );
      toast.success(`Renamed to ${normalizedNewPath.split("/").pop()}`);
    },
    [fileStructure, setFileStructure, setOpenTabs],
  );

  return {
    fileStructure,
    setFileStructure,
    expandedFolders,
    setExpandedFolders,
    selectedFile,
    setSelectedFile,
    toggleFolder,
    getFileContent,
    setFileContent,
    handleFileClick,
    handleSaveCurrentFile,
    handleFileContentChange,
    handleCreateFile,
    handleCreateFolder,
    handleDeleteNode,
    handleRenameNode,
    isLoading: !storageLoaded,
    project: {
      name: projectId ? "Orin project" : "New Orin project",
      fileTree: fileStructure,
    },
  };
};
