import type { User } from "@orin/db";

declare global {
  namespace Express {
    interface Request {
      dbUser?: User;
    }
  }
}

export {};
