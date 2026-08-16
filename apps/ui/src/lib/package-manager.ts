import type { FileSystemTree } from "@webcontainer/api";
import type { WebContainer } from "@webcontainer/api";

export type PackageManager = "npm" | "pnpm" | "bun";

export interface PackageCommand {
  command: string;
  args: string[];
  label: string;
}

type FsLike = Pick<WebContainer["fs"], "readFile" | "readdir">;

function joinPath(root: string, ...parts: string[]): string {
  if (root === "/") {
    return `/${parts.join("/")}`;
  }
  return `${root}/${parts.join("/")}`;
}

async function fileExists(fs: FsLike, path: string): Promise<boolean> {
  try {
    await fs.readFile(path, "utf-8");
    return true;
  } catch {
    return false;
  }
}

async function dirExists(fs: FsLike, path: string): Promise<boolean> {
  try {
    await fs.readdir(path);
    return true;
  } catch {
    return false;
  }
}

export async function getProjectRoot(fs: FsLike): Promise<string | null> {
  if (await fileExists(fs, "/package.json")) {
    return "/";
  }

  if (await fileExists(fs, "/vanilla-web-app/package.json")) {
    return "/vanilla-web-app";
  }

  return null;
}

export async function detectPackageManager(
  fs: FsLike,
  projectRoot: string,
): Promise<PackageManager> {
  if (
    (await fileExists(fs, joinPath(projectRoot, "bun.lockb"))) ||
    (await fileExists(fs, joinPath(projectRoot, "bun.lock")))
  ) {
    return "bun";
  }

  if (await fileExists(fs, joinPath(projectRoot, "pnpm-lock.yaml"))) {
    return "pnpm";
  }

  try {
    const raw = await fs.readFile(joinPath(projectRoot, "package.json"), "utf-8");
    const pkg = JSON.parse(raw) as { packageManager?: string };
    const manager = pkg.packageManager?.split("@")[0]?.trim();
    if (manager === "pnpm" || manager === "bun" || manager === "npm") {
      return manager;
    }
  } catch {
    // fall through to npm
  }

  return "npm";
}

export function getInstallCommand(manager: PackageManager): PackageCommand {
  switch (manager) {
    case "pnpm":
      return {
        command: "npx",
        args: ["pnpm", "install"],
        label: "pnpm install",
      };
    case "bun":
      return {
        command: "npm",
        args: ["install"],
        label: "npm install",
      };
    default:
      return {
        command: "npm",
        args: ["install"],
        label: "npm install",
      };
  }
}

export function getDevCommand(manager: PackageManager): PackageCommand {
  switch (manager) {
    case "pnpm":
      return {
        command: "npx",
        args: ["pnpm", "run", "dev"],
        label: "pnpm run dev",
      };
    case "bun":
      return {
        command: "npm",
        args: ["run", "dev"],
        label: "npm run dev",
      };
    default:
      return {
        command: "npm",
        args: ["run", "dev"],
        label: "npm run dev",
      };
  }
}

export async function needsInstall(
  fs: FsLike,
  projectRoot: string,
): Promise<boolean> {
  if (!(await fileExists(fs, joinPath(projectRoot, "package.json")))) {
    return false;
  }

  return !(await dirExists(fs, joinPath(projectRoot, "node_modules")));
}

function treeHasFile(tree: FileSystemTree, targetPath: string): boolean {
  const parts = targetPath.split("/").filter(Boolean);
  let current: FileSystemTree = tree;

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const node = current[part];
    if (!node) return false;

    const isFile = index === parts.length - 1;
    if (isFile) {
      return "file" in node;
    }

    if (!("directory" in node)) return false;
    current = node.directory;
  }

  return false;
}

function readPackageManagerField(tree: FileSystemTree): PackageManager | null {
  const readJsonAt = (pathParts: string[]): PackageManager | null => {
    let current: FileSystemTree = tree;
    for (let index = 0; index < pathParts.length; index += 1) {
      const part = pathParts[index];
      const node = current[part];
      if (!node) return null;

      const isFile = index === pathParts.length - 1;
      if (isFile) {
        if (!("file" in node)) return null;
        const fileNode = node.file;
        const contents =
          typeof fileNode === "string"
            ? fileNode
            : "contents" in fileNode && typeof fileNode.contents === "string"
              ? fileNode.contents
              : null;
        if (!contents) return null;

        try {
          const pkg = JSON.parse(contents) as { packageManager?: string };
          const manager = pkg.packageManager?.split("@")[0]?.trim();
          if (manager === "pnpm" || manager === "bun" || manager === "npm") {
            return manager;
          }
        } catch {
          return null;
        }
        return null;
      }

      if (!("directory" in node)) return null;
      current = node.directory;
    }
    return null;
  };

  return readJsonAt(["package.json"]) ?? readJsonAt(["vanilla-web-app", "package.json"]);
}

/** Detect package manager from the persisted project tree (for UI hints). */
export function detectPackageManagerFromTree(
  tree: FileSystemTree,
): PackageManager {
  if (
    treeHasFile(tree, "bun.lockb") ||
    treeHasFile(tree, "bun.lock") ||
    treeHasFile(tree, "vanilla-web-app/bun.lockb") ||
    treeHasFile(tree, "vanilla-web-app/bun.lock")
  ) {
    return "bun";
  }

  if (
    treeHasFile(tree, "pnpm-lock.yaml") ||
    treeHasFile(tree, "vanilla-web-app/pnpm-lock.yaml")
  ) {
    return "pnpm";
  }

  return readPackageManagerField(tree) ?? "npm";
}

export function parseShellCommand(rawCommand: string): PackageCommand {
  const trimmed = rawCommand.trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    throw new Error("Shell command is empty");
  }

  return {
    command: parts[0],
    args: parts.slice(1),
    label: trimmed,
  };
}
