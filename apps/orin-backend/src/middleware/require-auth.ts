import type { NextFunction, Request, Response } from 'express';

/** Stub: drop custom JWT verification in here later. */
export function requireAuth(
    _req: Request,
    _res: Response,
    next: NextFunction,
): void {
    next();
}
