import { promisify } from "node:util";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import {
  AUTH_COOKIE_NAME,
  AUTH_TOKEN_TTL_SECONDS,
  DEFAULT_JWT_SECRET,
} from "./constants";

const scrypt = promisify(scryptCallback);
const TOKEN_ISSUER = "orin";
const PASSWORD_PREFIX = "scrypt";

export { AUTH_COOKIE_NAME, AUTH_TOKEN_TTL_SECONDS, DEFAULT_JWT_SECRET };

export type SessionUser = {
  id: string;
  email: string;
};

function getSecret(secret: string) {
  if (secret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long.");
  }
  return new TextEncoder().encode(secret);
}

export async function createToken(user: SessionUser, secret: string) {
  return new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(TOKEN_ISSUER)
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${AUTH_TOKEN_TTL_SECONDS}s`)
    .sign(getSecret(secret));
}

export async function verifyToken(token: string, secret: string): Promise<SessionUser> {
  const { payload } = await jwtVerify(token, getSecret(secret), {
    issuer: TOKEN_ISSUER,
  });

  if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
    throw new Error("Invalid session token.");
  }

  return { id: payload.sub, email: payload.email };
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${PASSWORD_PREFIX}$${salt}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [prefix, salt, encodedKey] = storedHash.split("$");
  if (prefix !== PASSWORD_PREFIX || !salt || !encodedKey) return false;

  try {
    const expected = Buffer.from(encodedKey, "hex");
    const actual = (await scrypt(password, salt, expected.length)) as Buffer;
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
