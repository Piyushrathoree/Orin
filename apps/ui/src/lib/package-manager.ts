import type { FileSystemTree } from "@webcontainer/api";
import type { WebContainer } from "@webcontainer/api";

export type PackageManager = "npm" | "pnpm" | "bun";

export interface PackageCommand {
  command: string;
  args: string[];
  label: string;
}

type FsLike = Pick<WebContainer["fs"], "readFile" | "readdir">;
type WritableFs = Pick<WebContainer["fs"], "readFile" | "readdir" | "writeFile">;

const VITE_CONFIG_FILES = [
  "vite.config.ts",
  "vite.config.js",
  "vite.config.mts",
  "vite.config.mjs",
] as const;

const NEXT_CONFIG_FILES = [
  "next.config.ts",
  "next.config.js",
  "next.config.mjs",
  "next.config.cjs",
] as const;

export const WEBCONTAINER_VITE_DEV_COMMAND: PackageCommand = {
  command: "npx",
  args: ["vite", "--host", "0.0.0.0", "--port", "3000"],
  label: "vite --host 0.0.0.0 --port 3000",
};

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

const SKIP_ROOT_DIRS = new Set(["node_modules", "proc", "sys", "dev", "tmp"]);

export async function getProjectRoot(fs: FsLike): Promise<string | null> {
  if (await fileExists(fs, "/package.json")) {
    return "/";
  }

  try {
    const entries = await fs.readdir("/");
    for (const entry of entries) {
      const name = typeof entry === "string" ? entry : String(entry);
      if (!name || name.startsWith(".") || SKIP_ROOT_DIRS.has(name)) continue;
      if (await fileExists(fs, `/${name}/package.json`)) {
        return `/${name}`;
      }
    }
  } catch {
    // fall through
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

async function readPackageJson(
  fs: FsLike,
  projectRoot: string,
): Promise<{
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
} | null> {
  try {
    const raw = await fs.readFile(joinPath(projectRoot, "package.json"), "utf-8");
    return JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
  } catch {
    return null;
  }
}

async function isViteProject(
  fs: FsLike,
  projectRoot: string,
): Promise<boolean> {
  for (const name of VITE_CONFIG_FILES) {
    if (await fileExists(fs, joinPath(projectRoot, name))) {
      return true;
    }
  }

  const pkg = await readPackageJson(fs, projectRoot);
  if (!pkg) return false;
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  return Boolean(deps.vite || pkg.scripts?.dev?.includes("vite"));
}

async function isNextProject(
  fs: FsLike,
  projectRoot: string,
): Promise<boolean> {
  for (const name of NEXT_CONFIG_FILES) {
    if (await fileExists(fs, joinPath(projectRoot, name))) {
      return true;
    }
  }

  const pkg = await readPackageJson(fs, projectRoot);
  if (!pkg) return false;
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  return Boolean(deps.next || pkg.scripts?.dev?.includes("next"));
}

/** Strip `next` from package.json so a leftover Next script cannot auto-start. */
async function rewriteNextDevScriptToVite(
  fs: WritableFs,
  projectRoot: string,
): Promise<void> {
  const pkg = await readPackageJson(fs, projectRoot);
  if (!pkg) return;

  let changed = false;
  if (pkg.scripts?.dev?.includes("next")) {
    pkg.scripts.dev = WEBCONTAINER_VITE_DEV_COMMAND.label;
    changed = true;
  }
  if (pkg.dependencies?.next) {
    delete pkg.dependencies.next;
    changed = true;
  }
  if (pkg.devDependencies?.next) {
    delete pkg.devDependencies.next;
    changed = true;
  }

  if (!changed) return;

  await fs.writeFile(
    joinPath(projectRoot, "package.json"),
    `${JSON.stringify(pkg, null, 2)}\n`,
  );
}

export async function getWebContainerDevCommand(
  fs: WritableFs,
  projectRoot: string,
): Promise<PackageCommand> {
  if (await isNextProject(fs, projectRoot)) {
    await rewriteNextDevScriptToVite(fs, projectRoot);
  }

  if (await isViteProject(fs, projectRoot)) {
    return WEBCONTAINER_VITE_DEV_COMMAND;
  }

  throw new Error(
    "WebContainer auto-start requires Vite. Next.js is not supported in this sandbox.",
  );
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

function getTreeProjectRootParts(tree: FileSystemTree): string[] {
  if (treeHasFile(tree, "package.json")) return [];

  for (const [name, node] of Object.entries(tree)) {
    if (node && "directory" in node && treeHasFile(node.directory, "package.json")) {
      return [name];
    }
  }

  return [];
}

export function getProjectRootFromTree(tree: FileSystemTree): string | null {
  if (treeHasFile(tree, "package.json")) return "/";
  const parts = getTreeProjectRootParts(tree);
  return parts.length > 0 ? `/${parts.join("/")}` : null;
}

/** Split a raw command on top-level `&&` / `;`. Quotes are respected; pipes are not. */
export function splitShellCommandChain(rawCommand: string): string[] {
  const segments: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < rawCommand.length; index += 1) {
    const char = rawCommand[index];

    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }

    if (char === ";") {
      const trimmed = current.trim();
      if (trimmed) segments.push(trimmed);
      current = "";
      continue;
    }

    if (char === "&" && rawCommand[index + 1] === "&") {
      const trimmed = current.trim();
      if (trimmed) segments.push(trimmed);
      current = "";
      index += 1;
      continue;
    }

    current += char;
  }

  const trimmed = current.trim();
  if (trimmed) segments.push(trimmed);
  return segments;
}

export function isDevServerCommand(command: string): boolean {
  const normalized = command.trim().toLowerCase();
  if (/\b(npm|pnpm|yarn|bun)(?:\s+run)?\s+dev\b/.test(normalized)) return true;
  if (/\bnext\s+dev\b/.test(normalized)) return true;
  return /\bvite\b/.test(normalized) && !/\bvite\s+build\b/.test(normalized);
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
