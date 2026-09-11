import { PROJECT_TEMPLATE_VERSION } from "@/data/project-file";

/**
 * Persists a WebContainer `node_modules` snapshot per project.
 *
 * The WebContainer filesystem is recreated from scratch on every page load, so
 * without this a full `npm install` blocks every single boot. We export
 * `node_modules` once after a successful install and re-mount it on the next
 * boot, which turns a multi-minute install into a mount.
 */

const DB_NAME = "orin-webcontainer";
const DB_VERSION = 1;
const STORE_NAME = "node-modules";

/** Snapshots larger than this are dropped rather than risking the storage quota. */
const MAX_SNAPSHOT_BYTES = 250 * 1024 * 1024;

export interface NodeModulesSnapshot {
  /** Binary WebContainer snapshot of the project's `node_modules` directory. */
  snapshot: Blob;
  /** Fingerprint of the package.json deps this snapshot was built from. */
  depsHash: string;
  /** `package-lock.json` as npm left it, so the next install can reuse it. */
  lockfile?: string;
  templateVersion: number;
  savedAt: number;
}

function cacheKey(projectId?: string): string {
  return projectId || "scratch";
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);

  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

function runRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadNodeModulesSnapshot(
  projectId?: string,
): Promise<NodeModulesSnapshot | null> {
  const db = await openDatabase();
  if (!db) return null;

  try {
    const store = db
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME);
    const record = await runRequest(
      store.get(cacheKey(projectId)) as IDBRequest<
        NodeModulesSnapshot | undefined
      >,
    );

    if (!record?.snapshot) return null;
    // A template bump changes the starter's dependencies wholesale.
    if (record.templateVersion !== PROJECT_TEMPLATE_VERSION) return null;
    return record;
  } catch (error) {
    console.warn("[orin] Could not read node_modules cache:", error);
    return null;
  } finally {
    db.close();
  }
}

export async function saveNodeModulesSnapshot(
  projectId: string | undefined,
  snapshot: Uint8Array,
  depsHash: string,
  lockfile?: string,
): Promise<boolean> {
  if (snapshot.byteLength > MAX_SNAPSHOT_BYTES) {
    console.warn(
      `[orin] node_modules snapshot is ${Math.round(snapshot.byteLength / 1024 / 1024)}MB, skipping cache.`,
    );
    return false;
  }

  const db = await openDatabase();
  if (!db) return false;

  try {
    const record: NodeModulesSnapshot = {
      // Copy into a Blob: the Uint8Array's buffer is detached once it has been
      // transferred to `mount`, and Blobs are what IndexedDB stores cheaply.
      snapshot: new Blob([snapshot as unknown as BlobPart]),
      depsHash,
      lockfile,
      templateVersion: PROJECT_TEMPLATE_VERSION,
      savedAt: Date.now(),
    };

    const transaction = db.transaction(STORE_NAME, "readwrite");
    const done = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    transaction.objectStore(STORE_NAME).put(record, cacheKey(projectId));
    await done;
    return true;
  } catch (error) {
    // Most likely a quota error - the IDE stays usable, installs just stay slow.
    console.warn("[orin] Could not cache node_modules:", error);
    return false;
  } finally {
    db.close();
  }
}

export async function deleteNodeModulesSnapshot(
  projectId?: string,
): Promise<void> {
  const db = await openDatabase();
  if (!db) return;

  try {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(cacheKey(projectId));
  } catch (error) {
    console.warn("[orin] Could not clear node_modules cache:", error);
  } finally {
    db.close();
  }
}
