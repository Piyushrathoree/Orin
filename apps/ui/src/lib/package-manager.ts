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

export function patchViteConfigForWebContainer(source: string): string {
  const hasAllowedHosts = /\ballowedHosts\b/.test(source);
  const hasHmrClientPort = /\bclientPort\b/.test(source);
  if (hasAllowedHosts && hasHmrClientPort) return source;

  let next = source;

  const injectServerBlock = (snippet: string) => {
    if (/server\s*:\s*\{/.test(next)) {
      next = next.replace(/server\s*:\s*\{/, `server: {\n    ${snippet}`);
      return true;
    }
    if (/defineConfig\s*\(\s*\{/.test(next)) {
      next = next.replace(
        /defineConfig\s*\(\s*\{/,
        `defineConfig({\n  server: {\n    ${snippet}\n  },`,
      );
      return true;
    }
    if (/export default\s*\{/.test(next)) {
      next = next.replace(
        /export default\s*\{/,
        `export default {\n  server: {\n    ${snippet}\n  },`,
      );
      return true;
    }
    return false;
  };

  if (!hasAllowedHosts) {
    injectServerBlock("allowedHosts: true,");
  }
  if (!/\bclientPort\b/.test(next)) {
    injectServerBlock("hmr: { clientPort: 443 },");
  }

  return next;
}

export async function ensureViteWebContainerServerConfig(
  fs: WritableFs,
  projectRoot: string,
): Promise<void> {
  for (const name of VITE_CONFIG_FILES) {
    const path = joinPath(projectRoot, name);
    if (!(await fileExists(fs, path))) continue;

    const source = await fs.readFile(path, "utf-8");
    const next = patchViteConfigForWebContainer(source);
    if (next !== source) {
      await fs.writeFile(path, next);
    }
    return;
  }
}

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
    await ensureViteWebContainerServerConfig(fs, projectRoot);
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

/** Specs npm cannot fetch from the registry, so they never count as "missing". */
const UNFETCHABLE_SPEC_PREFIXES = ["workspace:", "file:", "link:", "portal:"];

/**
 * Stable fingerprint of everything an install depends on. Used to tell whether
 * a cached `node_modules` snapshot still matches the current package.json.
 */
export function dependencyFingerprint(pkg: {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
} | null): string {
  if (!pkg) return "";

  const entries = [
    ...Object.entries(pkg.dependencies ?? {}).map(
      ([name, spec]) => `d:${name}@${spec}`,
    ),
    ...Object.entries(pkg.devDependencies ?? {}).map(
      ([name, spec]) => `v:${name}@${spec}`,
    ),
  ];

  return entries.sort().join("\n");
}

export async function readDependencyFingerprint(
  fs: FsLike,
  projectRoot: string,
): Promise<string> {
  return dependencyFingerprint(await readPackageJson(fs, projectRoot));
}

/**
 * Names declared in package.json that are absent from `node_modules`. Lets a
 * restored snapshot be topped up with just the newly added packages instead of
 * reinstalling everything.
 */
export async function getMissingDependencies(
  fs: FsLike,
  projectRoot: string,
): Promise<string[]> {
  const pkg = await readPackageJson(fs, projectRoot);
  if (!pkg) return [];

  const declared = { ...pkg.dependencies, ...pkg.devDependencies };
  const missing: string[] = [];

  for (const [name, spec] of Object.entries(declared)) {
    if (
      typeof spec === "string" &&
      UNFETCHABLE_SPEC_PREFIXES.some((prefix) => spec.startsWith(prefix))
    ) {
      continue;
    }

    const installed = await fileExists(
      fs,
      joinPath(projectRoot, "node_modules", name, "package.json"),
    );
    if (!installed) missing.push(name);
  }

  return missing;
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

export interface InstallCommand {
  /** `name` → version spec. Bare names get `latest`, the same tag npm resolves. */
  packages: Record<string, string>;
  dev: boolean;
}

const INSTALL_SUBCOMMANDS: Record<PackageManager | "yarn", string[]> = {
  npm: ["install", "i", "add"],
  pnpm: ["install", "i", "add"],
  bun: ["install", "i", "add"],
  yarn: ["add"],
};

const DEV_FLAGS = new Set(["-D", "--save-dev", "--dev", "-d"]);

function splitPackageSpec(spec: string): [string, string] {
  // `@scope/pkg@1.2.3` — the version separator is the last `@` after position 0.
  const at = spec.lastIndexOf("@");
  if (at <= 0) return [spec, "latest"];
  return [spec.slice(0, at), spec.slice(at + 1) || "latest"];
}

/**
 * Parses a single `npm i <pkg>`-style command. Returns null for anything that
 * is not a package-manager install; `packages` is empty for a bare install.
 */
export function parseInstallCommand(command: string): InstallCommand | null {
  const parts = command.trim().split(/\s+/).filter(Boolean);
  if (parts[0] === "npx" && parts[1] === "pnpm") parts.shift();

  const manager = parts[0] as keyof typeof INSTALL_SUBCOMMANDS;
  const subcommands = INSTALL_SUBCOMMANDS[manager];
  if (!subcommands || !subcommands.includes(parts[1])) return null;

  const packages: Record<string, string> = {};
  let dev = false;
  for (const arg of parts.slice(2)) {
    if (DEV_FLAGS.has(arg)) {
      dev = true;
      continue;
    }
    if (arg.startsWith("-")) continue;
    // Local/git specs can't be expressed as a registry dependency; leave them alone.
    if (/^(\.|\/|file:|git|https?:)/.test(arg)) return null;
    const [name, version] = splitPackageSpec(arg);
    packages[name] = version;
  }

  return { packages, dev };
}

function detectJsonIndent(source: string): string {
  const match = source.match(/^(\s+)"/m);
  return match ? match[1] : "  ";
}

/**
 * Adds packages to a package.json source string the way `npm i` would, so a
 * later plain install picks them up. Returns null when the manifest is not
 * valid JSON, and the input unchanged when nothing new is declared.
 */
export function addDependenciesToManifest(
  manifest: string,
  install: InstallCommand,
): string | null {
  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(manifest) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!pkg || typeof pkg !== "object" || Array.isArray(pkg)) return null;

  const field = install.dev ? "devDependencies" : "dependencies";
  const otherField = install.dev ? "dependencies" : "devDependencies";
  const current = { ...((pkg[field] as Record<string, string> | undefined) ?? {}) };
  const other = (pkg[otherField] as Record<string, string> | undefined) ?? {};

  let changed = false;
  for (const [name, version] of Object.entries(install.packages)) {
    // Already declared (in either block) with a pinned range - keep the user's range.
    if (name in current || name in other) continue;
    current[name] = version;
    changed = true;
  }
  if (!changed) return manifest;

  pkg[field] = Object.fromEntries(
    Object.entries(current).sort(([a], [b]) => a.localeCompare(b)),
  );
  return `${JSON.stringify(pkg, null, detectJsonIndent(manifest))}\n`;
}
