import { describe, expect, test } from "bun:test";
import {
  parseClientMessage,
  validateCodeFiles,
} from "./protocol";

describe("WebSocket code protocol", () => {
  test("accepts a bounded code snapshot", () => {
    expect(
      parseClientMessage(
        JSON.stringify({
          type: "code-init",
          roomId: "room-1",
          directories: ["src"],
          files: [{ path: "src/App.tsx", content: "export default 1;" }],
        }),
      ),
    ).toEqual({
      type: "code-init",
      roomId: "room-1",
      directories: ["src"],
      files: [{ path: "src/App.tsx", content: "export default 1;" }],
    });
  });

  test("rejects traversal and duplicate code paths", () => {
    expect(
      validateCodeFiles([
        { path: "../secret.ts", content: "nope" },
      ]),
    ).toBeNull();
    expect(
      validateCodeFiles([
        { path: "src/App.tsx", content: "one" },
        { path: "src/App.tsx", content: "two" },
      ]),
    ).toBeNull();
  });

  test("accepts a file deletion update", () => {
    expect(
      parseClientMessage(
        JSON.stringify({
          type: "code-update",
          roomId: "room-1",
          path: "src/App.tsx",
          content: null,
        }),
      ),
    ).toEqual({
      type: "code-update",
      roomId: "room-1",
      path: "src/App.tsx",
      content: null,
    });
  });

  test("rejects invalid room and peer messages", () => {
    expect(
      parseClientMessage(JSON.stringify({ type: "join", roomId: "" })),
    ).toBeNull();
    expect(
      parseClientMessage(
        JSON.stringify({
          type: "message",
          roomId: "room-1",
          message: " ",
        }),
      ),
    ).toBeNull();
  });
});
