import { createHash, randomBytes } from "node:crypto";
import nodemailer from "nodemailer";
import { AuthTokenType, prisma } from "@orin/db";
import { config } from "../config/environment";

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function frontendUrl(path: string, token: string) {
  const url = new URL(path, `${config.frontendUrl.replace(/\/$/, "")}/`);
  url.searchParams.set("token", token);
  return url.toString();
}

function createTransporter() {
  if (!config.smtpConfigured) {
    throw new Error("SMTP is not configured");
  }

  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  });
}

async function sendAuthEmail(to: string, subject: string, text: string) {
  await createTransporter().sendMail({
    from: config.smtpFrom,
    to,
    subject,
    text,
  });
}

export async function issueAuthToken(userId: string, type: AuthTokenType) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + (type === AuthTokenType.EMAIL_VERIFICATION
      ? EMAIL_VERIFICATION_TTL_MS
      : PASSWORD_RESET_TTL_MS),
  );

  await prisma.authToken.deleteMany({ where: { userId, type } });
  await prisma.authToken.create({
    data: {
      userId,
      type,
      tokenHash: hashToken(token),
      expiresAt,
    },
  });

  return token;
}

export async function findValidAuthToken(token: string, type: AuthTokenType) {
  const record = await prisma.authToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!record || record.type !== type || record.usedAt || record.expiresAt <= new Date()) {
    return null;
  }

  return record;
}

export async function sendVerificationEmail(email: string, token: string) {
  const link = frontendUrl("/verify-email", token);
  await sendAuthEmail(
    email,
    "Verify your Orin email address",
    `Verify your Orin account by opening this link:\n\n${link}\n\nThis link expires in 24 hours.`,
  );
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const link = frontendUrl("/reset-password", token);
  await sendAuthEmail(
    email,
    "Reset your Orin password",
    `Reset your Orin password by opening this link:\n\n${link}\n\nThis link expires in 30 minutes. If you did not request this, you can ignore this email.`,
  );
}
