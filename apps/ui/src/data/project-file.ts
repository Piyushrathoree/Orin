import type { FileSystemTree } from "@webcontainer/api";

export const DEFAULT_PROJECT_NAME = "my-app";

/** Bump when the in-browser starter must replace older saved trees. */
export const PROJECT_TEMPLATE_VERSION = 3;
export const PROJECT_STORAGE_PREFIX = `orin:project:v${PROJECT_TEMPLATE_VERSION}:`;
export const PREVIOUS_PROJECT_STORAGE_PREFIX = `orin:project:v${PROJECT_TEMPLATE_VERSION - 1}:`;
export const LEGACY_PROJECT_STORAGE_PREFIX = "orin:project:";
export const TEMPLATE_VERSION_STORAGE_KEY = "orin:template-version";

const NEXT_CONFIG_FILES = [
  "next.config.ts",
  "next.config.js",
  "next.config.mjs",
  "next.config.cjs",
] as const;

const VITE_CONFIG_FILES = [
  "vite.config.ts",
  "vite.config.js",
  "vite.config.mts",
  "vite.config.mjs",
] as const;

export function getProjectStorageKey(projectId?: string): string {
  return `${PROJECT_STORAGE_PREFIX}${projectId || "scratch"}`;
}

export function getPreviousProjectStorageKey(projectId?: string): string {
  return `${PREVIOUS_PROJECT_STORAGE_PREFIX}${projectId || "scratch"}`;
}

export function getLegacyProjectStorageKey(projectId?: string): string {
  return `${LEGACY_PROJECT_STORAGE_PREFIX}${projectId || "scratch"}`;
}

export function sanitizeProjectName(raw: string): string {
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "")
    .slice(0, 214);

  return slug || DEFAULT_PROJECT_NAME;
}

function file(contents: string) {
  return { file: { contents } };
}

function directory(children: FileSystemTree) {
  return { directory: children };
}

export function getRootDirectoryName(tree: FileSystemTree): string {
  const root = Object.keys(tree).find((key) => {
    const node = tree[key];
    return Boolean(node && "directory" in node);
  });

  return root ?? DEFAULT_PROJECT_NAME;
}

export function getDefaultExpandedFolders(tree: FileSystemTree): Set<string> {
  const root = getRootDirectoryName(tree);
  return new Set([root, `${root}/src`]);
}

function isFileNode(
  node: FileSystemTree[string] | undefined,
): node is Extract<FileSystemTree[string], { file: unknown }> {
  return Boolean(node && "file" in node);
}

function isDirectoryNode(
  node: FileSystemTree[string] | undefined,
): node is Extract<FileSystemTree[string], { directory: FileSystemTree }> {
  return Boolean(node && "directory" in node);
}

function getTreeNode(
  tree: FileSystemTree,
  path: string,
): FileSystemTree[string] | undefined {
  const parts = path.split("/").filter(Boolean);
  let current = tree;

  for (let index = 0; index < parts.length; index += 1) {
    const node = current[parts[index]];
    if (!node) return undefined;
    if (index === parts.length - 1) return node;
    if (!isDirectoryNode(node)) return undefined;
    current = node.directory;
  }

  return undefined;
}

function treeHasFile(tree: FileSystemTree, path: string): boolean {
  return isFileNode(getTreeNode(tree, path));
}

function readTreeFileText(tree: FileSystemTree, path: string): string | null {
  const node = getTreeNode(tree, path);
  if (!isFileNode(node)) return null;

  const file = node.file;
  if (typeof file === "string") return file;
  if (!("contents" in file)) return null;
  if (typeof file.contents === "string") return file.contents;
  if (file.contents instanceof Uint8Array) {
    return new TextDecoder().decode(file.contents);
  }
  return null;
}

function getStarterProjectRoot(tree: FileSystemTree): FileSystemTree {
  if (treeHasFile(tree, "package.json")) return tree;

  for (const node of Object.values(tree)) {
    if (isDirectoryNode(node) && treeHasFile(node.directory, "package.json")) {
      return node.directory;
    }
  }

  const firstDirectory = Object.values(tree).find(isDirectoryNode);
  return firstDirectory ? firstDirectory.directory : tree;
}

function readStarterPackageJson(
  projectRoot: FileSystemTree,
): {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
} | null {
  const raw = readTreeFileText(projectRoot, "package.json");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
  } catch {
    return null;
  }
}

/**
 * Saved trees from earlier Orin starters (Next.js or vanilla Express) must be
 * replaced so WebContainer boots the current Vite template. Generated Vite
 * apps are left alone, including Tailwind v3 output from the AI template.
 */
export function isStaleStarterTree(tree: FileSystemTree): boolean {
  if (Object.prototype.hasOwnProperty.call(tree, "vanilla-web-app")) {
    return true;
  }
  if (getRootDirectoryName(tree) === "vanilla-web-app") {
    return true;
  }

  const projectRoot = getStarterProjectRoot(tree);
  if (NEXT_CONFIG_FILES.some((name) => treeHasFile(projectRoot, name))) {
    return true;
  }
  if (
    (treeHasFile(projectRoot, "src/app/page.tsx") ||
      treeHasFile(projectRoot, "app/page.tsx")) &&
    !VITE_CONFIG_FILES.some((name) => treeHasFile(projectRoot, name))
  ) {
    return true;
  }

  const pkg = readStarterPackageJson(projectRoot);
  if (!pkg) return false;

  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (deps.next) return true;
  if (pkg.scripts?.dev?.includes("next")) return true;
  if (deps.express && !deps.react && !deps.vite) return true;
  if (pkg.scripts?.dev?.includes("node server.js")) return true;

  return false;
}

export function resolveProjectTree(
  saved: FileSystemTree | null,
  fallbackName: string = DEFAULT_PROJECT_NAME,
): FileSystemTree {
  if (!saved || isStaleStarterTree(saved)) {
    const fromTree = saved ? getRootDirectoryName(saved) : fallbackName;
    const name = fromTree === "vanilla-web-app" ? fallbackName : fromTree;
    return createProjectFiles(sanitizeProjectName(name));
  }

  return saved;
}

const VITE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" width="32" height="32" preserveAspectRatio="xMidYMid meet" viewBox="0 0 256 257"><defs><linearGradient id="vite-a" x1="-.828%" x2="57.636%" y1="7.652%" y2="78.411%"><stop offset="0%" stop-color="#41D1FF"/><stop offset="100%" stop-color="#BD34FE"/></linearGradient><linearGradient id="vite-b" x1="43.376%" x2="50.316%" y1="2.242%" y2="89.03%"><stop offset="0%" stop-color="#FFEA83"/><stop offset="8.333%" stop-color="#FFDD35"/><stop offset="100%" stop-color="#FFA800"/></linearGradient></defs><path fill="url(#vite-a)" d="M255.153 37.938 134.897 252.976c-2.483 4.44-8.862 4.466-11.382.048L.875 37.958c-2.746-4.812 1.371-10.646 6.827-9.67l120.385 21.517a6.537 6.537 0 0 0 2.322-.004l117.867-21.483c5.438-.991 9.574 4.796 6.877 9.62Z"/><path fill="url(#vite-b)" d="M185.432.063 96.44 17.501a3.268 3.268 0 0 0-2.634 3.014l-5.474 92.456a3.268 3.268 0 0 0 3.997 3.378l24.777-5.718c2.318-.536 4.413 1.507 3.936 3.838l-7.361 36.047c-.495 2.426 1.782 4.5 4.151 3.78l15.229-4.693c2.372-.727 4.652 1.35 4.151 3.788l-11.698 56.621c-.732 3.542 3.979 5.473 5.943 2.437l1.313-2.028 72.516-144.72c1.215-2.423-.88-5.186-3.54-4.672l-25.505 4.922c-2.396.462-4.435-1.77-3.759-4.114l16.646-57.705c.677-2.35-1.37-4.575-3.769-4.042Z"/></svg>
`;

function createPackageJson(name: string): string {
  return `${JSON.stringify(
    {
      name,
      private: true,
      version: "0.0.0",
      type: "module",
      scripts: {
        dev: "vite --host 0.0.0.0 --port 3000",
        build: "tsc -b && vite build",
        lint: "eslint .",
        preview: "vite preview --host 0.0.0.0 --port 3000",
      },
      dependencies: {
        react: "^19.2.8",
        "react-dom": "^19.2.8",
      },
      devDependencies: {
        "@eslint/js": "^9.25.0",
        "@tailwindcss/vite": "^4.1.18",
        "@types/react": "^19.2.18",
        "@types/react-dom": "^19.2.4",
        "@vitejs/plugin-react": "^4.7.0",
        eslint: "^9.25.0",
        "eslint-plugin-react-hooks": "^5.2.0",
        "eslint-plugin-react-refresh": "^0.4.19",
        globals: "^16.0.0",
        tailwindcss: "^4.1.18",
        typescript: "~5.8.3",
        "typescript-eslint": "^8.30.1",
        vite: "^7.3.6",
      },
    },
    null,
    2,
  )}\n`;
}

const VITE_CONFIG = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: '0.0.0.0', port: 3000 },
})
`;

const TSCONFIG = `{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
`;

const TSCONFIG_APP = `{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["src"]
}
`;

const TSCONFIG_NODE = `{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["vite.config.ts"]
}
`;

const INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite + React + Tailwind</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

const ESLINT_CONFIG = `import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
)
`;

const GITIGNORE = `# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
.ntvs*
.njsproj
.sln
*.sw?
`;

const MAIN_TSX = `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
`;

const REACT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" width="24" height="21.35" preserveAspectRatio="xMidYMid meet" viewBox="-11.5 -10.23174 23 20.46348"><circle cx="0" cy="0" r="2.05" fill="#61dafb"/><g stroke="#61dafb" stroke-width="1" fill="none"><ellipse rx="11" ry="4.2"/><ellipse rx="11" ry="4.2" transform="rotate(60)"/><ellipse rx="11" ry="4.2" transform="rotate(120)"/></g></svg>
`;

const APP_TSX = `import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'

function App() {
  const [count, setCount] = useState(0)

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 text-white">
      <div className="flex items-center gap-10">
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="h-28 w-28" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="h-28 w-28" alt="React logo" />
        </a>
      </div>
      <h1 className="mt-10 text-4xl font-semibold tracking-tight">
        Vite + React + Tailwind
      </h1>
      <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
        <button
          className="rounded-xl bg-sky-500 px-5 py-2.5 font-medium text-white hover:bg-sky-400"
          onClick={() => setCount((count) => count + 1)}
        >
          count is {count}
        </button>
        <p className="mt-4 text-sm text-zinc-400">
          Edit <code className="rounded-md bg-zinc-800 px-1.5 py-0.5 text-sky-300">src/App.tsx</code> and save to test HMR
        </p>
      </div>
    </main>
  )
}

export default App
`;

const INDEX_CSS = `@import "tailwindcss";
`;

const VITE_ENV_D_TS = `/// <reference types="vite/client" />
`;

export function createProjectFiles(
  projectName: string = DEFAULT_PROJECT_NAME,
): FileSystemTree {
  const name = sanitizeProjectName(projectName);

  return {
    [name]: directory({
      "package.json": file(createPackageJson(name)),
      "vite.config.ts": file(VITE_CONFIG),
      "tsconfig.json": file(TSCONFIG),
      "tsconfig.app.json": file(TSCONFIG_APP),
      "tsconfig.node.json": file(TSCONFIG_NODE),
      "index.html": file(INDEX_HTML),
      "eslint.config.js": file(ESLINT_CONFIG),
      ".gitignore": file(GITIGNORE),
      public: directory({
        "vite.svg": file(VITE_SVG),
      }),
      src: directory({
        "main.tsx": file(MAIN_TSX),
        "App.tsx": file(APP_TSX),
        "index.css": file(INDEX_CSS),
        "vite-env.d.ts": file(VITE_ENV_D_TS),
        assets: directory({
          "react.svg": file(REACT_SVG),
        }),
      }),
    }),
  };
}
