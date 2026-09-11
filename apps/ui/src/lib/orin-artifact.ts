import type { FileSystemTree } from "@webcontainer/api";
import {
  addDependenciesToManifest,
  getProjectRootFromTree,
  isDevServerCommand,
  parseInstallCommand,
  splitShellCommandChain,
} from "@/lib/package-manager";

export interface SharedCodeFile {
  path: string;
  content: string;
}

export interface SharedCodeSnapshot {
  files: SharedCodeFile[];
  directories: string[];
}

export type OrinAction =
  | { type: "file"; path: string; content: string }
  | { type: "directory"; path: string }
  | { type: "delete"; path: string }
  | { type: "shell"; command: string };

export function normalizeOrinPath(path: string): string | null {
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

    if (type === "shell") {
      const command = (match[2] ?? "").trim();
      if (command) {
        actions.push({ type: "shell", command });
      }
      continue;
    }

    const rawPath = attributes.match(
      /\b(?:filePath|path)\s*=\s*["']([^"']+)["']/i,
    )?.[1];
    const path = rawPath ? normalizeOrinPath(rawPath) : null;

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

function filesToTree(files: SharedCodeFile[]): FileSystemTree {
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

function directoriesToTree(paths: string[]): FileSystemTree {
  const tree: FileSystemTree = {};

  for (const path of paths) {
    const parts = path.split("/").filter(Boolean);
    let directory = tree;

    for (const part of parts) {
      const existing = directory[part];
      if (existing && "directory" in existing) {
        directory = existing.directory;
        continue;
      }

      const nestedDirectory: FileSystemTree = {};
      directory[part] = { directory: nestedDirectory };
      directory = nestedDirectory;
    }
  }

  return tree;
}

function mergeFileTrees(
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
    const updatedTree = { ...tree };
    delete updatedTree[name];
    return updatedTree;
  }

  if (!("directory" in node)) return tree;

  const updatedDirectory = removeFileFromTree(node.directory, remainingParts);
  if (updatedDirectory === node.directory) return tree;

  const updatedTree = { ...tree };
  updatedTree[name] = { directory: updatedDirectory };

  return updatedTree;
}

function projectFolderPrefix(tree: FileSystemTree): string {
  const root = getProjectRootFromTree(tree);
  if (!root || root === "/") return "";
  return root.replace(/^\/+/, "");
}

/**
 * AI actions are relative to the Vite project root. Orin trees nest that
 * project under a folder such as `my-app/`, so prefix paths when needed.
 */
export function localizeOrinActions(
  actions: OrinAction[],
  tree: FileSystemTree,
): OrinAction[] {
  const prefix = projectFolderPrefix(tree);
  if (!prefix) return actions;

  return actions.map((action) => {
    if (action.type === "shell") return action;
    if (action.path === prefix || action.path.startsWith(`${prefix}/`)) {
      return action;
    }
    return { ...action, path: `${prefix}/${action.path}` };
  });
}

function treeHasPath(tree: FileSystemTree, path: string): boolean {
  let current: FileSystemTree = tree;
  const parts = path.split("/").filter(Boolean);

  for (let index = 0; index < parts.length; index += 1) {
    const node = current[parts[index]];
    if (!node) return false;
    if (index === parts.length - 1) return true;
    if (!("directory" in node)) return false;
    current = node.directory;
  }

  return parts.length > 0;
}

function readTreeText(tree: FileSystemTree, path: string): string | null {
  let current: FileSystemTree = tree;
  const parts = path.split("/").filter(Boolean);

  for (let index = 0; index < parts.length; index += 1) {
    const node = current[parts[index]];
    if (!node) return null;
    if (index === parts.length - 1) {
      if (!("file" in node) || !("contents" in node.file)) return null;
      const { contents } = node.file;
      return typeof contents === "string" ? contents : new TextDecoder().decode(contents);
    }
    if (!("directory" in node)) return null;
    current = node.directory;
  }

  return null;
}

/** Drops actions that would leave the tree as it already is. Paths are tree-relative. */
export function filterEffectiveActions(
  tree: FileSystemTree,
  actions: OrinAction[],
): OrinAction[] {
  return actions.filter((action) => {
    switch (action.type) {
      case "file":
        return readTreeText(tree, action.path) !== action.content;
      case "directory":
        return !treeHasPath(tree, action.path);
      case "delete":
        return treeHasPath(tree, action.path);
      default:
        return true;
    }
  });
}

const MANIFEST_PATH = "package.json";

/**
 * Rewrites `npm i <pkg>` shell actions into package.json edits. Installs are
 * the user's to run, and a dependency that only lives in the container's
 * node_modules is lost on reload - declaring it in the tree's manifest means a
 * single install brings everything in. Bare installs are dropped entirely.
 */
export function inlineInstallCommands(
  actions: OrinAction[],
  tree: FileSystemTree,
): OrinAction[] {
  const prefix = projectFolderPrefix(tree);
  let manifest = readTreeText(tree, prefix ? `${prefix}/${MANIFEST_PATH}` : MANIFEST_PATH);
  const result: OrinAction[] = [];

  for (const action of actions) {
    if (action.type === "file" && action.path === MANIFEST_PATH) {
      manifest = action.content;
      result.push(action);
      continue;
    }
    if (action.type !== "shell") {
      result.push(action);
      continue;
    }

    const passthrough: string[] = [];
    let manifestChanged = false;
    for (const segment of splitShellCommandChain(action.command)) {
      const install = parseInstallCommand(segment);
      if (!install) {
        passthrough.push(segment);
        continue;
      }
      if (Object.keys(install.packages).length === 0) continue;

      const next = manifest === null ? null : addDependenciesToManifest(manifest, install);
      if (next === null) {
        // No manifest to edit, or unparsable: leave the command to run as-is.
        passthrough.push(segment);
        continue;
      }
      if (next !== manifest) {
        manifest = next;
        manifestChanged = true;
      }
    }

    if (manifestChanged && manifest !== null) {
      result.push({ type: "file", path: MANIFEST_PATH, content: manifest });
    }
    if (passthrough.length > 0) {
      result.push({ type: "shell", command: passthrough.join(" && ") });
    }
  }

  return result;
}

export type OrinChangeKind = "added" | "updated" | "deleted" | "folder" | "command";

export type OrinChange = {
  kind: OrinChangeKind;
  /** Project-relative path for file changes, the command text for shell actions. */
  label: string;
};

/**
 * Human-readable summary of what a response will do to the project. Must be
 * called *before* the actions are applied, otherwise every file looks updated.
 * Paths are shown relative to the project root, as the AI wrote them.
 */
export function describeOrinActions(
  actions: OrinAction[],
  tree: FileSystemTree,
): OrinChange[] {
  const localized = localizeOrinActions(actions, tree);
  const byPath = new Map<string, OrinChange>();
  const commands: OrinChange[] = [];

  actions.forEach((action, index) => {
    if (action.type === "shell") {
      commands.push({ kind: "command", label: action.command });
      return;
    }

    const localizedAction = localized[index];
    const localizedPath =
      localizedAction && localizedAction.type !== "shell"
        ? localizedAction.path
        : action.path;
    const existed = treeHasPath(tree, localizedPath);

    // Later actions on the same path win, but "added" sticks: a file created
    // and then rewritten in one response is still new to the project.
    const previous = byPath.get(action.path);
    let kind: OrinChangeKind;
    if (action.type === "delete") {
      kind = "deleted";
    } else if (action.type === "directory") {
      kind = "folder";
    } else if (previous?.kind === "added" || !existed) {
      kind = "added";
    } else {
      kind = "updated";
    }

    byPath.set(action.path, { kind, label: action.path });
  });

  return [...byPath.values(), ...commands];
}

export function isAutoStartedDevCommand(command: string): boolean {
  const segments = splitShellCommandChain(command);
  return segments.length > 0 && segments.every(isDevServerCommand);
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

    if (action.type === "directory") {
      return mergeFileTrees(updatedTree, directoriesToTree([action.path]));
    }

    if (action.type === "delete") {
      return removeFileFromTree(updatedTree, action.path.split("/"));
    }

    return updatedTree;
  }, tree);
}

/** Returns the bounded text-file and directory snapshot shared through WS. */
export function fileTreeToCodeSnapshot(
  tree: FileSystemTree,
): SharedCodeSnapshot {
  const files: SharedCodeFile[] = [];
  const directories: string[] = [];

  const visit = (current: FileSystemTree, parentPath = "") => {
    for (const [name, node] of Object.entries(current)) {
      const path = parentPath ? `${parentPath}/${name}` : name;

      if ("directory" in node) {
        directories.push(path);
        visit(node.directory, path);
        continue;
      }

      if (typeof node.file === "string") {
        files.push({ path, content: node.file });
      } else if (
        "contents" in node.file &&
        typeof node.file.contents === "string"
      ) {
        files.push({ path, content: node.file.contents });
      }
    }
  };

  visit(tree);
  return { files, directories };
}

export function fileTreeToCodeFiles(tree: FileSystemTree): SharedCodeFile[] {
  return fileTreeToCodeSnapshot(tree).files;
}

export function fileTreeToPrompt(tree: FileSystemTree): string {
  const files: SharedCodeFile[] = [];

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
