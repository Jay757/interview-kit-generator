import { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session || !req.session.userId) {
    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required. Please log in.",
      },
    });
    return;
  }

  next();
}
