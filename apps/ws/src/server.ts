import { DEFAULT_JWT_SECRET, verifyToken, AUTH_COOKIE_NAME } from "@orin/auth";
import { WebSocketServer } from "ws";
import type { RawData, WebSocket } from "ws";
import {
  MAX_CODE_FILES,
  MAX_CODE_PATH_LENGTH,
  MAX_CODE_SNAPSHOT_SIZE,
  parseClientMessage,
  type ClientMessage,
  type CodeFile,
} from "./protocol.js";

type RoomState = {
  clients: Set<WebSocket>;
  codeFiles: Map<string, string>;
  codeDirectories: Set<string>;
  codeInitialized: boolean;
  revision: number;
};

const requestedPort = Number.parseInt(process.env.PORT ?? "8080", 10);
const port = Number.isFinite(requestedPort) ? requestedPort : 8080;
const wss = new WebSocketServer({
  port,
  maxPayload:
    MAX_CODE_SNAPSHOT_SIZE +
    2 * MAX_CODE_FILES * MAX_CODE_PATH_LENGTH +
    64 * 1024,
});

const rooms = new Map<string, RoomState>();
const socketRooms = new Map<WebSocket, string>();

function cookieValue(header: string | undefined, name: string) {
  for (const item of header?.split(";") ?? []) {
    const separator = item.indexOf("=");
    if (separator < 0 || item.slice(0, separator).trim() !== name) continue;
    return decodeURIComponent(item.slice(separator + 1).trim());
  }
  return null;
}

function send(ws: WebSocket, payload: Record<string, unknown>) {
  if (ws.readyState === 1) ws.send(JSON.stringify(payload));
}

function getRoomForSocket(ws: WebSocket, roomId: string): RoomState | undefined {
  if (socketRooms.get(ws) !== roomId) return undefined;
  return rooms.get(roomId);
}

function broadcast(
  room: RoomState,
  payload: Record<string, unknown>,
  except?: WebSocket,
) {
  for (const client of room.clients) {
    if (client !== except) send(client, payload);
  }
}

function snapshotFiles(room: RoomState): CodeFile[] {
  return Array.from(room.codeFiles, ([path, content]) => ({ path, content }));
}

function sendCodeSnapshot(ws: WebSocket, roomId: string, room: RoomState) {
  send(ws, {
    type: "code-snapshot",
    roomId,
    revision: room.revision,
    files: snapshotFiles(room),
    directories: Array.from(room.codeDirectories),
  });
}

function leaveRoom(ws: WebSocket) {
  const roomId = socketRooms.get(ws);
  if (!roomId) return;

  socketRooms.delete(ws);
  const room = rooms.get(roomId);
  if (!room) return;

  room.clients.delete(ws);
  if (room.clients.size === 0) {
    rooms.delete(roomId);
    return;
  }

  broadcast(room, { type: "user-count", count: room.clients.size });
}

function applySnapshot(
  room: RoomState,
  files: CodeFile[],
  directories: string[],
) {
  room.codeFiles = new Map(files.map((file) => [file.path, file.content]));
  room.codeDirectories = new Set(directories);
  room.codeInitialized = true;
  room.revision += 1;
}

function relayPeerMessage(ws: WebSocket, message: ClientMessage) {
  if (
    message.type !== "message" &&
    message.type !== "FileContent" &&
    message.type !== "offer" &&
    message.type !== "answer" &&
    message.type !== "candidate"
  ) {
    return;
  }

  const room = getRoomForSocket(ws, message.roomId);
  if (!room) return;

  if (message.type === "message") {
    broadcast(room, { type: "message", message: message.message }, ws);
    return;
  }

  if (message.type === "FileContent") {
    broadcast(
      room,
      {
        type: "FileContent",
        FileContent: message.FileContent,
        pos: message.CursorPos,
      },
      ws,
    );
    return;
  }

  if (message.type === "offer") {
    broadcast(
      room,
      { type: "offer", roomId: message.roomId, offer: message.offer },
      ws,
    );
  } else if (message.type === "answer") {
    broadcast(
      room,
      { type: "answer", roomId: message.roomId, answer: message.answer },
      ws,
    );
  } else {
    broadcast(
      room,
      {
        type: "candidate",
        roomId: message.roomId,
        candidate: message.candidate,
      },
      ws,
    );
  }
}

function handleCodeMessage(
  ws: WebSocket,
  message: Extract<ClientMessage, { type: "code-init" | "code-snapshot" | "code-update" }>,
) {
  const room = getRoomForSocket(ws, message.roomId);
  if (!room) return;

  if (message.type === "code-update") {
    if (!room.codeInitialized) return;

    if (message.content === null) room.codeFiles.delete(message.path);
    else room.codeFiles.set(message.path, message.content);
    room.revision += 1;

    broadcast(
      room,
      {
        type: "code-update",
        roomId: message.roomId,
        revision: room.revision,
        path: message.path,
        content: message.content,
      },
      ws,
    );
    send(ws, { type: "code-ack", revision: room.revision });
    return;
  }

  if (message.type === "code-init" && room.codeInitialized) {
    sendCodeSnapshot(ws, message.roomId, room);
    return;
  }

  applySnapshot(room, message.files, message.directories);
  broadcast(
    room,
    {
      type: "code-snapshot",
      roomId: message.roomId,
      revision: room.revision,
      files: snapshotFiles(room),
      directories: Array.from(room.codeDirectories),
    },
    ws,
  );
  send(ws, { type: "code-ack", revision: room.revision });
}

function joinRoom(ws: WebSocket, roomId: string) {
  const currentRoomId = socketRooms.get(ws);
  if (currentRoomId === roomId) return;

  const existingRoom = rooms.get(roomId);
  if (existingRoom && existingRoom.clients.size >= 2) {
    send(ws, { type: "toast", message: "Room already filled" });
    return;
  }

  if (currentRoomId) leaveRoom(ws);

  const room = existingRoom ?? {
    clients: new Set<WebSocket>(),
    codeFiles: new Map<string, string>(),
    codeDirectories: new Set<string>(),
    codeInitialized: false,
    revision: 0,
  };

  rooms.set(roomId, room);
  room.clients.add(ws);
  socketRooms.set(ws, roomId);

  send(ws, { type: "joined", roomId });
  send(ws, { type: "toast", message: `Connected to ${roomId}` });
  broadcast(room, { type: "user-count", count: room.clients.size });

  if (room.clients.size === 1) {
    send(ws, { type: "code-sync-owner" });
  } else if (room.codeInitialized) {
    sendCodeSnapshot(ws, roomId, room);
  } else {
    broadcast(room, { type: "code-sync-request" }, ws);
  }

  if (room.clients.size === 2) {
    const firstClient = Array.from(room.clients)[0];
    if (firstClient && firstClient !== ws) {
      send(firstClient, {
        type: "send-offer",
        message: "Peer joined, you can start the transfer!",
      });
    }
  }
}

wss.on("connection", (ws: WebSocket, request) => {
  void (async () => {
    const token = cookieValue(request.headers.cookie, AUTH_COOKIE_NAME);
    if (!token) {
      ws.close(1008, "Authentication required");
      return;
    }

    try {
      await verifyToken(token, process.env.JWT_SECRET || DEFAULT_JWT_SECRET);
    } catch {
      ws.close(1008, "Invalid session");
      return;
    }

    ws.on("message", (data: RawData) => {
      const message = parseClientMessage(data.toString());
      if (!message) return;

      if (message.type === "join") {
        joinRoom(ws, message.roomId);
        return;
      }

      if (
        message.type === "code-init" ||
        message.type === "code-snapshot" ||
        message.type === "code-update"
      ) {
        handleCodeMessage(ws, message);
        return;
      }

      relayPeerMessage(ws, message);
    });

    ws.on("close", () => leaveRoom(ws));
    ws.on("error", () => leaveRoom(ws));
  })();
});

console.log(`[Orin WS] Listening on ws://localhost:${port}`);
