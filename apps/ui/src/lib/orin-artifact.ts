import type { FileSystemTree } from "@webcontainer/api";

export interface OrinFile {
  path: string;
  content: string;
}

export type OrinAction =
  | { type: "file"; path: string; content: string }
  | { type: "delete"; path: string };

function normalizeFilePath(path: string): string | null {
  const normalizedPath = path.trim();
  if (
    !normalizedPath ||
    normalizedPath.startsWith("/") ||
    normalizedPath.includes("\\") ||
    normalizedPath.includes("\0")
  ) {
    return null;
  }

  const parts = normalizedPath.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) {
    return null;
  }

  return parts.join("/");
}

/** Extracts the supported actions emitted by the Orin backend, in response order. */
export function parseOrinActions(response: string): OrinAction[] {
  const actions: OrinAction[] = [];
  const actionPattern = /<orinAction\b([^>]*)>([\s\S]*?)<\/orinAction>/gi;

  for (const match of response.matchAll(actionPattern)) {
    const attributes = match[1] ?? "";
    const type = attributes.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1];
    const rawPath = attributes.match(
      /\b(?:filePath|path)\s*=\s*["']([^"']+)["']/i,
    )?.[1];
    const path = rawPath ? normalizeFilePath(rawPath) : null;

    if (!path) continue;

    if (type === "file") {
      actions.push({
        type,
        path,
        content: (match[2] ?? "").replace(/^\n/, "").replace(/\n$/, ""),
      });
    } else if (type === "delete") {
      actions.push({ type, path });
    }
  }

  return actions;
}

/** Removes machine-readable actions so chat messages contain only the AI's explanation. */
export function getOrinResponseText(response: string): string {
  return response
    .replace(/<orinArtifact\b[^>]*>/gi, "")
    .replace(/<\/orinArtifact>/gi, "")
    .replace(/<orinAction\b[^>]*>[\s\S]*?<\/orinAction>/gi, "")
    .trim();
}

/** Extracts the file actions emitted by the Orin backend. */
export function parseOrinArtifact(response: string): OrinFile[] {
  const files = new Map<string, OrinFile>();
  for (const action of parseOrinActions(response)) {
    if (action.type !== "file") continue;
    files.set(action.path, action);
  }

  return [...files.values()];
}

export function filesToTree(files: OrinFile[]): FileSystemTree {
  const tree: FileSystemTree = {};

  for (const file of files) {
    const parts = file.path.split("/").filter(Boolean);
    if (parts.length === 0) continue;

    let directory = tree;
    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;

      if (isFile) {
        directory[part] = { file: { contents: file.content } };
        return;
      }

      const existing = directory[part];
      if (existing && "directory" in existing) {
        directory = existing.directory;
      } else {
        const nestedDirectory: FileSystemTree = {};
        directory[part] = { directory: nestedDirectory };
        directory = nestedDirectory;
      }
    });
  }

  return tree;
}

export function mergeFileTrees(
  base: FileSystemTree,
  updates: FileSystemTree,
): FileSystemTree {
  const merged: FileSystemTree = { ...base };

  for (const [name, update] of Object.entries(updates)) {
    const current = merged[name];
    if ("directory" in update) {
      const currentDirectory =
        current && "directory" in current ? current.directory : {};
      merged[name] = {
        directory: mergeFileTrees(currentDirectory, update.directory),
      };
    } else {
      merged[name] = update;
    }
  }

  return merged;
}

function removeFileFromTree(
  tree: FileSystemTree,
  pathParts: string[],
): FileSystemTree {
  const [name, ...remainingParts] = pathParts;
  const node = tree[name];
  if (!node) return tree;

  if (remainingParts.length === 0) {
    if (!("file" in node)) return tree;
    const updatedTree = { ...tree };
    delete updatedTree[name];
    return updatedTree;
  }

  if (!("directory" in node)) return tree;

  const updatedDirectory = removeFileFromTree(node.directory, remainingParts);
  if (updatedDirectory === node.directory) return tree;

  const updatedTree = { ...tree };
  if (Object.keys(updatedDirectory).length === 0) {
    delete updatedTree[name];
  } else {
    updatedTree[name] = { directory: updatedDirectory };
  }

  return updatedTree;
}

/** Applies ordered file writes and file deletions to a project tree. */
export function applyOrinActions(
  tree: FileSystemTree,
  actions: OrinAction[],
): FileSystemTree {
  return actions.reduce((updatedTree, action) => {
    if (action.type === "file") {
      return mergeFileTrees(updatedTree, filesToTree([action]));
    }

    return removeFileFromTree(updatedTree, action.path.split("/"));
  }, tree);
}

export function fileTreeToPrompt(tree: FileSystemTree): string {
  const files: OrinFile[] = [];

  const visit = (current: FileSystemTree, parentPath = "") => {
    for (const [name, node] of Object.entries(current)) {
      const path = parentPath ? `${parentPath}/${name}` : name;

      if ("directory" in node) {
        visit(node.directory, path);
        continue;
      }

      if (typeof node.file === "string") {
        files.push({ path, content: node.file });
      } else if ("contents" in node.file) {
        files.push({
          path,
          content:
            typeof node.file.contents === "string"
              ? node.file.contents
              : new TextDecoder().decode(node.file.contents),
        });
      }
    }
  };

  visit(tree);

  const actions = files
    .map(
      (file) =>
        `<orinAction type="file" filePath="${file.path}">${file.content}</orinAction>`,
    )
    .join("\n");

  return `<orinArtifact id="current-project" title="Current project">${actions}</orinArtifact>`;
}
