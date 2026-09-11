import { verifyToken, verifyWsTicket } from "@orin/auth";
import type { NextFunction, Request, Response } from "express";
import { config } from "../config/environment";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authorization = req.header("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : null;

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    req.user = await verifyToken(token, config.jwtSecret);
    req.authKind = "session";
    next();
    return;
  } catch {
    // Fall through: the WebSocket server presents short-lived tickets, not sessions.
  }

  try {
    req.user = await verifyWsTicket(token, config.jwtSecret);
    req.authKind = "ws-ticket";
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session" });
  }
}
