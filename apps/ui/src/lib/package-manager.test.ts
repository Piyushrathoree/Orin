import { describe, expect, test } from "bun:test";
import {
  parseShellCommand,
  splitShellCommandChain,
} from "./package-manager";

describe("splitShellCommandChain", () => {
  test("splits top-level &&", () => {
    expect(splitShellCommandChain("npm install && npm run dev")).toEqual([
      "npm install",
      "npm run dev",
    ]);
  });

  test("splits top-level semicolons", () => {
    expect(splitShellCommandChain("npm install; npm run dev")).toEqual([
      "npm install",
      "npm run dev",
    ]);
  });

  test("does not split && or ; inside quotes", () => {
    expect(
      splitShellCommandChain(`echo "foo && bar"; echo 'a; b' && npm run dev`),
    ).toEqual([`echo "foo && bar"`, `echo 'a; b'`, "npm run dev"]);
  });

  test("trims whitespace and ignores empty segments", () => {
    expect(
      splitShellCommandChain("  npm install  &&   &&  npm run dev  "),
    ).toEqual(["npm install", "npm run dev"]);
  });
});

describe("parseShellCommand", () => {
  test("parses a single command after the chain is split", () => {
    expect(parseShellCommand("npm install")).toEqual({
      command: "npm",
      args: ["install"],
      label: "npm install",
    });
  });
});
