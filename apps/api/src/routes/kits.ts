import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import { Kit } from "../models/Kit.js";
import { requireAuth } from "../middleware/auth.js";
import { validateKit } from "../validation/kitValidator.js";
import { crawlCompanySite } from "../pipeline/retrieval/index.js";
import {
  extractRequirements,
  extractCompanyBrief,
  generateAllQuestions,
  generateFlashcards,
} from "../pipeline/generation/index.js";
import { runCoverageLoop } from "../pipeline/coverage/index.js";
import { allocateSchedule } from "../pipeline/schedule/index.js";

const router = Router();

// All kit CRUD routes require active session
router.use(requireAuth);

// POST /kits/preview-extraction - Interactive extraction test endpoint for frontend
router.post("/preview-extraction", async (req: Request, res: Response) => {
  try {
    const { jdText, companyUrl, daysAvailable } = req.body;

    if (!jdText || typeof jdText !== "string" || !jdText.trim()) {
      res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: "A non-empty jdText string is required.",
        },
      });
      return;
    }

    let aboutText = "";
    let hiringText: string | null = null;
    let crawledPages = { used: [] as string[], skipped: [] as any[] };

    if (companyUrl && typeof companyUrl === "string" && companyUrl.trim()) {
      const crawl = await crawlCompanySite(companyUrl.trim());
      aboutText = crawl.aboutText;
      hiringText = crawl.hiringText;
      crawledPages = {
        used: crawl.pagesUsed,
        skipped: crawl.pagesSkipped,
      };
    }

    const [requirements, companyBrief] = await Promise.all([
      extractRequirements(jdText.trim()),
      extractCompanyBrief(aboutText, hiringText),
    ]);

    // 1. Generate initial draft questions
    const draftQuestions = await generateAllQuestions(requirements, hiringText);

    // 2. Deterministic coverage loop (Phase 7)
    const { questions: coveredQuestions, coverage } = await runCoverageLoop(
      requirements,
      draftQuestions,
      (uncovered) => generateAllQuestions(uncovered, hiringText)
    );

    // 3. Spaced-repetition flashcards
    const flashcards = await generateFlashcards(coveredQuestions);

    // 4. Deterministic schedule allocation (Phase 7)
    const days = typeof daysAvailable === "number" && daysAvailable >= 1 ? daysAvailable : 5;
    const schedule = allocateSchedule(requirements, coveredQuestions, days);

    res.status(200).json({
      success: true,
      requirements,
      companyBrief,
      questions: coveredQuestions,
      flashcards,
      coverage,
      schedule,
      crawledPages,
    });
  } catch (error: any) {
    console.error("Extraction preview error:", error);
    res.status(error.status || 500).json({
      error: {
        code: error.code || "EXTRACTION_FAILED",
        message: error.message || "Failed to extract requirements.",
        details: error.details,
      },
    });
  }
});

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
