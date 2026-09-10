import express, { Request, Response } from "express";
import cors from "cors";
import session, { Store } from "express-session";
import MongoStore from "connect-mongo";
import authRouter from "./routes/auth.js";
import kitsRouter from "./routes/kits.js";
import { requireAuth } from "./middleware/auth.js";

interface CreateAppOptions {
  sessionStore?: Store;
}

export function createApp(options?: CreateAppOptions) {
  const app = express();

  const allowedOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";
  app.use(
    cors({
      origin: allowedOrigin,
      credentials: true,
    })
  );

  app.use(express.json());

  // Session configuration
  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/trao_dev";
  const store =
    options?.sessionStore ||
    MongoStore.create({
      mongoUrl: mongoUri,
      collectionName: "sessions",
      ttl: 14 * 24 * 60 * 60, // 14 days
      autoRemove: "native",
    });

  const isProduction = process.env.NODE_ENV === "production";

  app.use(
    session({
      name: process.env.SESSION_COOKIE_NAME || "trao_session",
      secret: process.env.SESSION_SECRET || "trao-dev-session-secret-key-32-chars-minimum",
      resave: false,
      saveUninitialized: false,
      store,
      cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
      },
    })
  );

  // Mount Auth routes
  app.use("/auth", authRouter);

  // Mount Kit CRUD routes
  app.use("/kits", kitsRouter);

  // Index and health endpoints
  app.get("/", (_req: Request, res: Response) => {
    res.status(200).json({
      name: "Trao AI Interview Prep Kit API",
      status: "ok",
      endpoints: {
        health: "/health",
        auth: {
          register: "POST /auth/register",
          login: "POST /auth/login",
          logout: "POST /auth/logout",
          me: "GET /auth/me",
        },
        frontend: "http://localhost:3000",
      },
    });
  });

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  // Example protected route to verify auth middleware
  app.get("/protected-test", requireAuth, (req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      message: "Access granted to protected resource",
      userId: req.session.userId,
    });
  });

  return app;
}
