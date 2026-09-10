import { Router, Request, Response } from "express";
import { User } from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

// POST /auth/register
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
      res.status(400).json({
        error: {
          code: "INVALID_INPUT",
          message: "A valid email address is required.",
        },
      });
      return;
    }

    if (!password || typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({
        error: {
          code: "INVALID_INPUT",
          message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
        },
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      res.status(409).json({
        error: {
          code: "EMAIL_ALREADY_EXISTS",
          message: "An account with this email already exists.",
        },
      });
      return;
    }

    const user = new User({
      email: normalizedEmail,
      password,
    });

    await user.save();

    req.session.userId = user._id.toString();
    req.session.email = user.email;

    req.session.save((err) => {
      if (err) {
        console.error("Session save error during registration:", err);
        res.status(500).json({
          error: {
            code: "SESSION_ERROR",
            message: "Failed to establish session.",
          },
        });
        return;
      }

      res.status(201).json({
        user: {
          id: user._id.toString(),
          email: user.email,
          createdAt: user.createdAt,
        },
      });
    });
  } catch (error: any) {
    console.error("Registration error:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred during registration.",
      },
    });
  }
});

// POST /auth/login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      res.status(400).json({
        error: {
          code: "INVALID_INPUT",
          message: "Both email and password are required.",
        },
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      res.status(401).json({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password.",
        },
      });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password.",
        },
      });
      return;
    }

    req.session.userId = user._id.toString();
    req.session.email = user.email;

    req.session.save((err) => {
      if (err) {
        console.error("Session save error during login:", err);
        res.status(500).json({
          error: {
            code: "SESSION_ERROR",
            message: "Failed to establish session.",
          },
        });
        return;
      }

      res.status(200).json({
        user: {
          id: user._id.toString(),
          email: user.email,
          createdAt: user.createdAt,
        },
      });
    });
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred during login.",
      },
    });
  }
});

// POST /auth/logout
router.post("/logout", (req: Request, res: Response) => {
  const cookieName = process.env.SESSION_COOKIE_NAME || "trao_session";

  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      res.status(500).json({
        error: {
          code: "LOGOUT_FAILED",
          message: "Could not log out. Please try again.",
        },
      });
      return;
    }

    res.clearCookie(cookieName);
    res.status(200).json({ status: "ok" });
  });
});

// GET /auth/me
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.session.userId);

    if (!user) {
      req.session.destroy(() => {});
      res.clearCookie(process.env.SESSION_COOKIE_NAME || "trao_session");
      res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Session is invalid or user no longer exists.",
        },
      });
      return;
    }

    res.status(200).json({
      user: {
        id: user._id.toString(),
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    console.error("Fetch profile error:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred fetching the user profile.",
      },
    });
  }
});

export default router;
