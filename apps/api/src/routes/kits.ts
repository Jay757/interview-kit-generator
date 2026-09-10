import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import { Kit } from "../models/Kit.js";
import { requireAuth } from "../middleware/auth.js";
import { validateKit } from "../validation/kitValidator.js";

const router = Router();

// All kit CRUD routes require active session
router.use(requireAuth);

// POST /kits - Dev / stub persistence endpoint validating against Appendix A shape
router.post("/", async (req: Request, res: Response) => {
  try {
    const validation = validateKit(req.body);

    if (!validation.success) {
      res.status(400).json({
        error: {
          code: "INVALID_KIT_STRUCTURE",
          message: "The provided kit object violates Appendix A specifications.",
          details: validation.errors,
        },
      });
      return;
    }

    const kit = new Kit({
      ...validation.data,
      ownerId: req.session.userId,
      status: "completed",
    });

    await kit.save();

    res.status(201).json({
      kit,
    });
  } catch (error: any) {
    console.error("Kit creation error:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred while creating the kit.",
      },
    });
  }
});

// GET /kits - List only the current user's kits
router.get("/", async (req: Request, res: Response) => {
  try {
    const kits = await Kit.find({ ownerId: req.session.userId }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      kits,
    });
  } catch (error: any) {
    console.error("Fetch kits error:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred while fetching your kits.",
      },
    });
  }
});

// GET /kits/:id - Fetch single kit, strictly owner-scoped
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Kit not found.",
        },
      });
      return;
    }

    const kit = await Kit.findById(id);

    if (!kit) {
      res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Kit not found.",
        },
      });
      return;
    }

    // Owner authorization check
    if (kit.ownerId.toString() !== req.session.userId) {
      res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission to access this kit.",
        },
      });
      return;
    }

    res.status(200).json({
      kit,
    });
  } catch (error: any) {
    console.error("Fetch kit by id error:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred while fetching the kit.",
      },
    });
  }
});

// DELETE /kits/:id - Delete kit, strictly owner-scoped
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Kit not found.",
        },
      });
      return;
    }

    const kit = await Kit.findById(id);

    if (!kit) {
      res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Kit not found.",
        },
      });
      return;
    }

    // Owner authorization check
    if (kit.ownerId.toString() !== req.session.userId) {
      res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission to delete this kit.",
        },
      });
      return;
    }

    await Kit.findByIdAndDelete(id);

    res.status(200).json({
      status: "ok",
      message: "Kit deleted successfully.",
    });
  } catch (error: any) {
    console.error("Delete kit error:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred while deleting the kit.",
      },
    });
  }
});

export default router;
