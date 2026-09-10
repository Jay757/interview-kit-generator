import express, { Request, Response } from "express";
import cors from "cors";

export function createApp() {
  const app = express();

  const allowedOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";
  app.use(
    cors({
      origin: allowedOrigin,
      credentials: true,
    })
  );

  app.use(express.json());

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  return app;
}
