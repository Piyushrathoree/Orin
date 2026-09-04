export const MAX_ROOM_ID_LENGTH = 128;
export const MAX_CODE_PATH_LENGTH = 512;
export const MAX_CODE_FILE_SIZE = 512 * 1024;
export const MAX_CODE_FILES = 1_000;
export const MAX_CODE_SNAPSHOT_SIZE = 2 * 1024 * 1024;
export const MAX_PEER_MESSAGE_LENGTH = 16 * 1024;

export type CodeFile = {
  path: string;
  content: string;
};

export type CodeSnapshot = {
  files: CodeFile[];
  directories: string[];
};

export type ClientMessage =
  | { type: "join"; roomId: string }
  | { type: "message"; roomId: string; message: string }
  | { type: "FileContent"; roomId: string; FileContent: unknown; CursorPos?: unknown }
  | { type: "offer"; roomId: string; offer: Record<string, unknown> }
  | { type: "answer"; roomId: string; answer: Record<string, unknown> }
  | { type: "candidate"; roomId: string; candidate: Record<string, unknown> }
  | { type: "code-init"; roomId: string; files: CodeFile[]; directories: string[] }
  | {
      type: "code-snapshot";
      roomId: string;
      files: CodeFile[];
      directories: string[];
    }
  | { type: "code-update"; roomId: string; path: string; content: string | null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function isValidRoomId(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_ROOM_ID_LENGTH
  ) {
    return false;
  }

  return Array.from(value).every((character) => {
    const code = character.charCodeAt(0);
    return code > 0x1f && code !== 0x7f;
  });
}

export function normalizeCodePath(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const path = value.trim();
  if (
    !path ||
    path.length > MAX_CODE_PATH_LENGTH ||
    path.startsWith("/") ||
    path.includes("\\") ||
    path.includes("\u0000")
  ) {
    return null;
  }

  const parts = path.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) {
    return null;
  }

  return parts.join("/");
}

export function validateCodeFiles(value: unknown): CodeFile[] | null {
  if (!Array.isArray(value) || value.length > MAX_CODE_FILES) return null;

  const files: CodeFile[] = [];
  const paths = new Set<string>();
  let totalSize = 0;

  for (const item of value) {
    if (!isRecord(item)) return null;

    const path = normalizeCodePath(item.path);
    const content = item.content;
    if (!path || typeof content !== "string" || content.length > MAX_CODE_FILE_SIZE) {
      return null;
    }
    if (paths.has(path)) return null;

    totalSize += content.length;
    if (totalSize > MAX_CODE_SNAPSHOT_SIZE) return null;

    paths.add(path);
    files.push({ path, content });
  }

  return files;
}

export function validateCodeDirectories(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_CODE_FILES) return null;

  const directories: string[] = [];
  const paths = new Set<string>();
  for (const item of value) {
    const path = normalizeCodePath(item);
    if (!path || paths.has(path)) return null;
    paths.add(path);
    directories.push(path);
  }

  return directories;
}

function parseObject(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function parseClientMessage(value: string): ClientMessage | null {
  const message = parseObject(value);
  if (!message || typeof message.type !== "string") return null;

  if (message.type === "join") {
    return isValidRoomId(message.roomId)
      ? { type: "join", roomId: message.roomId }
      : null;
  }

  if (!isValidRoomId(message.roomId)) return null;
  const roomId = message.roomId;

  if (message.type === "message") {
    return typeof message.message === "string" &&
      message.message.trim().length > 0 &&
      message.message.length <= MAX_PEER_MESSAGE_LENGTH
      ? { type: "message", roomId, message: message.message }
      : null;
  }

  if (message.type === "FileContent") {
    return {
      type: "FileContent",
      roomId,
      FileContent: message.FileContent,
      CursorPos: message.CursorPos,
    };
  }

  if (message.type === "offer" || message.type === "answer" || message.type === "candidate") {
    const payload = message[message.type];
    return isRecord(payload)
      ? { type: message.type, roomId, [message.type]: payload } as ClientMessage
      : null;
  }

  if (message.type === "code-init" || message.type === "code-snapshot") {
    const files = validateCodeFiles(message.files);
    const directories = validateCodeDirectories(message.directories);
    return files && directories
      ? { type: message.type, roomId, files, directories }
      : null;
  }

  if (message.type === "code-update") {
    const path = normalizeCodePath(message.path);
    const content = message.content;
    return path && (content === null || typeof content === "string") &&
      (content === null || content.length <= MAX_CODE_FILE_SIZE)
      ? { type: "code-update", roomId, path, content }
      : null;
  }

  return null;
}
