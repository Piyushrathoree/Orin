"use client";

import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { json } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
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
import { useTheme } from "next-themes";
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

const lightSyntax = syntaxHighlighting(
  HighlightStyle.define([
    { tag: t.keyword, color: "#0b6e99" },
    { tag: [t.name, t.deleted, t.character, t.propertyName], color: "#871094" },
    { tag: [t.function(t.variableName), t.labelName], color: "#6f42c1" },
    { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: "#0550ae" },
    { tag: [t.definition(t.name), t.separator], color: "#953800" },
    { tag: [t.typeName, t.className, t.number, t.changed, t.annotation], color: "#0550ae" },
    { tag: [t.operator, t.operatorKeyword], color: "#0969da" },
    { tag: [t.url, t.escape, t.regexp, t.link], color: "#0a3069" },
    { tag: [t.meta, t.comment], color: "#57606a", fontStyle: "italic" },
    { tag: t.strong, fontWeight: "bold" },
    { tag: t.emphasis, fontStyle: "italic" },
    { tag: t.strikethrough, textDecoration: "line-through" },
    { tag: t.link, color: "#0969da", textDecoration: "underline" },
    { tag: t.heading, fontWeight: "bold", color: "#0550ae" },
    { tag: [t.atom, t.bool, t.special(t.variableName)], color: "#0550ae" },
    { tag: t.processingInstruction, color: "#57606a" },
    { tag: t.string, color: "#0a3069" },
    { tag: t.invalid, color: "#cf222e" },
  ]),
);

function createEditorTheme(isDark: boolean) {
  return EditorView.theme(
    {
      "&": {
        height: "100%",
        backgroundColor: "hsl(var(--editor))",
        color: "hsl(var(--foreground))",
      },
      ".cm-scroller": {
        overflow: "auto",
        fontFamily:
          "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
      },
      ".cm-content": {
        padding: "8px 0",
        caretColor: "hsl(var(--primary))",
      },
      ".cm-gutters": {
        backgroundColor: "hsl(var(--editor-gutter))",
        borderRight: "1px solid hsl(var(--border))",
        color: "hsl(var(--muted-foreground) / 0.55)",
      },
      ".cm-activeLine": {
        backgroundColor: "hsl(var(--editor-line))",
      },
      ".cm-activeLineGutter": {
        backgroundColor: "hsl(var(--editor-line))",
      },
      ".cm-lineNumbers .cm-gutterElement": {
        minWidth: "2.75rem",
        paddingRight: "0.75rem",
      },
      ".cm-cursor, .cm-dropCursor": {
        borderLeftColor: "hsl(var(--primary))",
      },
      ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
        backgroundColor: "hsl(var(--primary) / 0.18)",
      },
    },
    { dark: isDark },
  );
}

export default function CodeEditor({
  fileContent,
  filePath,
  onChange,
}: CodeEditorProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light";
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
        ...(isDark ? [oneDark] : [lightSyntax]),
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        drawSelection(),
        dropCursor(),
        rectangularSelection(),
        EditorView.lineWrapping,
        keymap.of([indentWithTab]),
        createEditorTheme(isDark),
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
  }, [filePath, isDark]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full bg-editor"
      data-file={filePath}
    />
  );
}
