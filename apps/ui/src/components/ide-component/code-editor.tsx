"use client";

import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { json } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  dropCursor,
  rectangularSelection,
} from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { useIDEStore } from "@/stores/ideStore";

interface CodeEditorProps {
  fileContent: string;
  filePath: string;
  onChange?: (content: string) => void;
}

function getLanguageExtension(filePath: string) {
  const ext = filePath.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
    case "mjs":
    case "cjs":
      return javascript({
        jsx: ext?.includes("x"),
        typescript: ext?.includes("ts"),
      });
    case "css":
      return css();
    case "html":
    case "htm":
      return html();
    case "json":
      return json();
    default:
      return javascript();
  }
}

export default function CodeEditor({
  fileContent,
  filePath,
  onChange,
}: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const initialContentRef = useRef(fileContent);
  const suppressOnChangeRef = useRef(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    initialContentRef.current = fileContent;

    if (viewRef.current) {
      const currentContent = viewRef.current.state.doc.toString();
      if (fileContent !== currentContent) {
        suppressOnChangeRef.current = true;
        viewRef.current.dispatch({
          changes: { from: 0, to: currentContent.length, insert: fileContent },
        });
        suppressOnChangeRef.current = false;
      }
    }
  }, [filePath, fileContent]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    container.innerHTML = "";

    const languageExtension = getLanguageExtension(filePath);

    const state = EditorState.create({
      doc: initialContentRef.current || "",
      extensions: [
        languageExtension,
        oneDark,
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        drawSelection(),
        dropCursor(),
        rectangularSelection(),
        EditorView.lineWrapping,
        keymap.of([indentWithTab]),
        EditorView.theme({
          "&": { height: "100%" },
          ".cm-scroller": { overflow: "auto" },
          ".cm-content": { padding: "10px 0" },
        }),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          if (suppressOnChangeRef.current) return;

          const content = update.state.doc.toString();

          if (onChangeRef.current) {
            onChangeRef.current(content);
          }
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: container,
    });

    viewRef.current = view;

    useIDEStore.getState().setEditorView(view);

    return () => {
      view.destroy();
      viewRef.current = null;
      useIDEStore.getState().setEditorView(null);
    };
  }, [filePath]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full bg-[#282c34]"
      data-file={filePath}
    />
  );
}
