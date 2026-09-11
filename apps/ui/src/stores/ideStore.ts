import { create } from "zustand";
import { FileSystemTree, WebContainer } from "@webcontainer/api";
import { EditorView } from "@codemirror/view";
import { createProjectFiles } from "@/data/project-file";

interface IDEStore {
  fileStructure: FileSystemTree;
  setFileStructure: (
    updater: FileSystemTree | ((prev: FileSystemTree) => FileSystemTree),
    options?: { recordHistory?: boolean },
  ) => void;
  past: FileSystemTree[];
  future: FileSystemTree[];
  undo: () => boolean;
  redo: () => boolean;
  canUndo: boolean;
  canRedo: boolean;
  clearHistory: () => void;
  editorRef: React.MutableRefObject<HTMLDivElement | null>;
  setEditorRef: (ref: React.MutableRefObject<HTMLDivElement | null>) => void;
  editorView: EditorView | null;
  setEditorView: (view: EditorView | null) => void;
  webContainerRef: React.MutableRefObject<WebContainer | null>;
  setWebContainerRef: (
    ref: React.MutableRefObject<WebContainer | null>,
  ) => void;
  liveUrl: string | null;
  setLiveUrl: (url: string | null) => void;
  previewRefreshKey: number;
  refreshPreview: () => void;
  activeTab: "code" | "preview";
  setActiveTab: (tab: "code" | "preview") => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  loadingMessage: string;
  setLoadingMessage: (message: string) => void;
  containerError: string | null;
  setContainerError: (error: string | null) => void;
  /** Commands the user must run before the preview can start, or null once nothing is pending. */
  setupHint: string | null;
  setSetupHint: (hint: string | null) => void;
  isContainerBooted: boolean;
  setIsContainerBooted: (booted: boolean) => void;
  previewDevice: "desktop" | "tablet" | "mobile";
  setPreviewDevice: (device: "desktop" | "tablet" | "mobile") => void;
}

const MAX_HISTORY_ENTRIES = 100;

const createIDEStore = () =>
  create<IDEStore>((set) => ({
    fileStructure: createProjectFiles(),
    setFileStructure: (updater, options = {}) =>
      set((state) => {
        const fileStructure =
          typeof updater === "function"
            ? updater(state.fileStructure)
            : updater;
        if (fileStructure === state.fileStructure) return state;

        if (options.recordHistory === false) {
          return { fileStructure };
        }

        return {
          fileStructure,
          past: [...state.past, state.fileStructure].slice(-MAX_HISTORY_ENTRIES),
          future: [],
          canUndo: true,
          canRedo: false,
        };
      }),
    past: [],
    future: [],
    canUndo: false,
    canRedo: false,
    undo: () => {
      let changed = false;
      set((state) => {
        const previous = state.past.at(-1);
        if (!previous) return state;
        changed = true;
        return {
          fileStructure: previous,
          past: state.past.slice(0, -1),
          future: [state.fileStructure, ...state.future].slice(0, MAX_HISTORY_ENTRIES),
          canUndo: state.past.length > 1,
          canRedo: true,
        };
      });
      return changed;
    },
    redo: () => {
      let changed = false;
      set((state) => {
        const next = state.future[0];
        if (!next) return state;
        changed = true;
        return {
          fileStructure: next,
          past: [...state.past, state.fileStructure].slice(-MAX_HISTORY_ENTRIES),
          future: state.future.slice(1),
          canUndo: true,
          canRedo: state.future.length > 1,
        };
      });
      return changed;
    },
    clearHistory: () => set({ past: [], future: [], canUndo: false, canRedo: false }),
    editorRef: { current: null },
    setEditorRef: (ref) => set({ editorRef: ref }),
    editorView: null,
    setEditorView: (view) => set({ editorView: view }),
    webContainerRef: { current: null },
    setWebContainerRef: (ref) => set({ webContainerRef: ref }),
    liveUrl: null,
    setLiveUrl: (url) => set({ liveUrl: url }),
    previewRefreshKey: 0,
    refreshPreview: () =>
      set((state) => ({ previewRefreshKey: state.previewRefreshKey + 1 })),
    activeTab: "code",
    setActiveTab: (tab) => set({ activeTab: tab }),
    isLoading: true,
    setIsLoading: (loading) => set({ isLoading: loading }),
    loadingMessage: "Initializing...",
    setLoadingMessage: (message) => set({ loadingMessage: message }),
    containerError: null,
    setContainerError: (error) => set({ containerError: error }),
    setupHint: null,
    setSetupHint: (hint) => set({ setupHint: hint }),
    isContainerBooted: false,
    setIsContainerBooted: (booted) => set({ isContainerBooted: booted }),
    previewDevice: "desktop",
    setPreviewDevice: (device) => set({ previewDevice: device }),
  }));

declare global {
  var __IDE_STORE_V3__: ReturnType<typeof createIDEStore> | undefined;
}

export const useIDEStore =
  globalThis.__IDE_STORE_V3__ ??
  (globalThis.__IDE_STORE_V3__ = createIDEStore());
