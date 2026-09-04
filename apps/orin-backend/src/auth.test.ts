import { describe, expect, test } from "bun:test";
import { createToken, hashPassword, verifyPassword, verifyToken } from "@orin/auth";

const secret = "test-secret-that-is-long-enough-for-jwt";
const user = { id: "user-1", email: "person@example.com" };

describe("shared authentication", () => {
  test("hashes and verifies passwords", async () => {
    const hash = await hashPassword("correct horse battery staple");

    expect(hash).not.toBe("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });

  test("creates and verifies session tokens", async () => {
    const token = await createToken(user, secret);

    expect(await verifyToken(token, secret)).toEqual(user);
    await expect(verifyToken(token, "different-secret-that-is-long-enough")).rejects.toThrow();
  });
});
