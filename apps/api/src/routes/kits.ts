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

import crypto from "crypto";
import { generateKit } from "../pipeline/orchestrate.js";

/**
 * Computes an idempotency hash for a kit generation request.
 */
export function computeGenerationHash(
  userId: string,
  jd: string,
  companyUrl?: string | null,
  days: number = 5
): string {
  const normJd = jd.trim().replace(/\r\n/g, "\n");
  const normUrl = (companyUrl || "").trim().toLowerCase();
  const normDays = days >= 1 ? Math.floor(days) : 5;
  return crypto
    .createHash("sha256")
    .update(`${userId}:::${normJd}:::${normUrl}:::${normDays}`)
    .digest("hex");
}

// POST /kits - Async kit generation endpoint with deduplication
router.post("/", async (req: Request, res: Response) => {
  try {
    const { jd, jdText, companyUrl, days } = req.body;
    const rawJd = jd || jdText;

    // 1. If an Appendix A kit structure is submitted (or attempted)
    const isKitStructureSubmission =
      req.body.source !== undefined ||
      req.body.role !== undefined ||
      req.body.questions !== undefined ||
      req.body.company_brief !== undefined;

    if (isKitStructureSubmission) {
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
        progressStage: "completed",
      });

      await kit.save();
      res.status(201).json({ kit });
      return;
    }

    // 2. Validate JD input for generation
    if (!rawJd || typeof rawJd !== "string" || !rawJd.trim()) {
      res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: "A non-empty job description string ('jd') is required to generate a kit.",
        },
      });
      return;
    }

    const trimmedJd = rawJd.trim();
    const daysAvailable =
      typeof days === "number" && days >= 1 ? Math.floor(days) : 5;
    const cleanCompanyUrl =
      typeof companyUrl === "string" && companyUrl.trim() ? companyUrl.trim() : "";

    // 3. Idempotency check (15-minute window to avoid double-spending LLM tokens)
    const hash = computeGenerationHash(
      req.session.userId!,
      trimmedJd,
      cleanCompanyUrl,
      daysAvailable
    );
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    const existingKit = await Kit.findOne({
      ownerId: req.session.userId,
      generationHash: hash,
      createdAt: { $gte: fifteenMinutesAgo },
      status: { $in: ["generating", "completed"] },
    });

    if (existingKit) {
      if (existingKit.status === "generating") {
        res.status(202).json({
          message: "Kit generation already in progress for this job description.",
          kitId: existingKit._id,
          status: "generating",
          isDuplicate: true,
        });
        return;
      }

      if (existingKit.status === "completed") {
        res.status(200).json({
          message: "Kit already generated recently. Returning existing kit.",
          kitId: existingKit._id,
          status: "completed",
          kit: existingKit,
          isDuplicate: true,
        });
        return;
      }
    }

    // 4. Create initial generating Kit record
    const kit = new Kit({
      ownerId: req.session.userId,
      status: "generating",
      generationHash: hash,
      progressStage: "retrieving",
      source: {
        company: "",
        company_url: cleanCompanyUrl,
        role: "",
        location: "",
        jd_chars: trimmedJd.length,
        researched_at: new Date().toISOString(),
        pages_used: [],
      },
      company_brief: {
        summary: "",
        what_they_do: "",
        sources: [],
      },
      role: {
        title: "",
        seniority: "",
        responsibilities: [],
        requirements: [],
      },
      questions: [],
      flashcards: [],
      schedule: {
        days_available: daysAvailable,
        days: [],
      },
      coverage: {
        uncovered_requirement_ids: [],
        passes: 0,
      },
    });

    await kit.save();

    // 5. Return 202 immediately to unblock client
    res.status(202).json({
      message: "Kit generation started.",
      kitId: kit._id,
      status: "generating",
    });

    // 6. Execute background pipeline without blocking HTTP response
    (async () => {
      try {
        const generated = await generateKit({
          jd: trimmedJd,
          companyUrl: cleanCompanyUrl,
          days: daysAvailable,
          options: {
            onProgress: async (stage) => {
              try {
                await Kit.updateOne({ _id: kit._id }, { progressStage: stage });
              } catch {
                // Ignore transient progress write errors
              }
            },
          },
        });

        await Kit.updateOne(
          { _id: kit._id },
          {
            status: "completed",
            progressStage: "completed",
            source: generated.source,
            company_brief: generated.company_brief,
            role: generated.role,
            questions: generated.questions,
            flashcards: generated.flashcards,
            schedule: generated.schedule,
            coverage: generated.coverage,
            errorMessage: null,
          }
        );
      } catch (err: any) {
        console.error(`Background kit generation failed for kit ${kit._id}:`, err);
        await Kit.updateOne(
          { _id: kit._id },
          {
            status: "failed",
            errorMessage: err.message || "Kit generation failed.",
          }
        ).catch(() => {});
      }
    })();
  } catch (error: any) {
    console.error("Kit creation error:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred while initiating kit creation.",
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

// GET /kits/:id/status - Polling endpoint for generation status & progress stage
router.get("/:id/status", async (req: Request, res: Response) => {
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

    const kit = await Kit.findById(id).select(
      "_id ownerId status progressStage errorMessage createdAt updatedAt"
    );

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
      kitId: kit._id,
      status: kit.status,
      stage: kit.progressStage || "starting",
      errorMessage: kit.errorMessage,
      updatedAt: kit.updatedAt,
      createdAt: kit.createdAt,
    });
  } catch (error: any) {
    console.error("Kit status polling error:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred while checking kit status.",
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

import { findUncoveredRequirements } from "../pipeline/coverage/index.js";
import { QuestionCategory } from "../types/kit.js";

// PATCH /kits/:id - Update kit fields with cascading schedule and coverage recalculation
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "Kit not found." },
      });
      return;
    }

    const kit = await Kit.findById(id);
    if (!kit) {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "Kit not found." },
      });
      return;
    }

    // Owner authorization check
    if (kit.ownerId.toString() !== req.session.userId) {
      res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission to edit this kit.",
        },
      });
      return;
    }

    // Apply allowed patch fields
    const { company_brief, role, questions, flashcards, schedule, coverage } = req.body;

    if (company_brief !== undefined) kit.company_brief = company_brief;
    if (role !== undefined) kit.role = role;
    if (questions !== undefined) kit.questions = questions;
    if (flashcards !== undefined) kit.flashcards = flashcards;
    if (schedule !== undefined) kit.schedule = schedule;
    if (coverage !== undefined) kit.coverage = coverage;

    // Automatic cascade deletion cleanup:
    // If questions were removed, remove their IDs from all schedule days
    if (Array.isArray(kit.questions) && kit.schedule && Array.isArray(kit.schedule.days)) {
      const existingQids = new Set(kit.questions.map((q: any) => q.id));
      for (const day of kit.schedule.days) {
        if (Array.isArray(day.question_ids)) {
          day.question_ids = day.question_ids.filter((qid: string) => existingQids.has(qid));
        }
      }
    }

    // Recompute coverage if questions or requirements changed
    if (kit.role && Array.isArray(kit.role.requirements) && Array.isArray(kit.questions)) {
      const uncovered = findUncoveredRequirements(kit.role.requirements, kit.questions);
      if (kit.coverage) {
        kit.coverage.uncovered_requirement_ids = uncovered;
      }
    }

    // Strict Appendix A validation
    const plainKit = kit.toObject();
    const validation = validateKit(plainKit);
    if (!validation.success) {
      res.status(400).json({
        error: {
          code: "INVALID_KIT_STRUCTURE",
          message: "Updated kit violates Appendix A structure.",
          details: validation.errors,
        },
      });
      return;
    }

    await kit.save();
    res.status(200).json({ kit });
  } catch (error: any) {
    console.error("Kit patch error:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to update kit." },
    });
  }
});

// POST /kits/:id/regenerate - Sectional regeneration preserving edited & pinned items (Rule 9)
router.post("/:id/regenerate", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Kit not found." } });
      return;
    }

    const kit = await Kit.findById(id);
    if (!kit) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Kit not found." } });
      return;
    }

    if (kit.ownerId.toString() !== req.session.userId) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "Unauthorized." } });
      return;
    }

    const { target, category } = req.body;

    // 1. Target: Schedule regeneration
    if (target === "schedule") {
      const days = kit.schedule?.days_available || 5;
      kit.schedule = allocateSchedule(kit.role.requirements, kit.questions, days);
      await kit.save();
      res.status(200).json({ kit, message: "Schedule regenerated successfully." });
      return;
    }

    // 2. Target: Company brief regeneration
    if (target === "company_brief") {
      // Rule 9: Never clobber edited or pinned brief
      if (kit.company_brief.state === "edited" || kit.company_brief.state === "pinned") {
        res.status(200).json({
          kit,
          message: "Company brief is marked as edited/pinned and was preserved untouched.",
        });
        return;
      }

      let aboutText = "";
      let hiringText: string | null = null;
      if (kit.source.company_url) {
        try {
          const crawl = await crawlCompanySite(kit.source.company_url);
          aboutText = crawl.aboutText;
          hiringText = crawl.hiringText;
        } catch {
          // fallback
        }
      }

      const newBrief = await extractCompanyBrief(aboutText, hiringText);
      kit.company_brief = {
        summary: newBrief.summary,
        what_they_do: newBrief.what_they_do,
        sources: kit.source.pages_used || [],
        state: "generated",
      };

      await kit.save();
      res.status(200).json({ kit, message: "Company brief regenerated successfully." });
      return;
    }

    // 3. Target: Question category regeneration
    if (target === "category" && category) {
      const validCategories: QuestionCategory[] = [
        "technical",
        "behavioural",
        "system-design",
        "company-fit",
      ];
      if (!validCategories.includes(category)) {
        res.status(400).json({
          error: { code: "BAD_REQUEST", message: `Invalid question category '${category}'.` },
        });
        return;
      }

      // Rule 9: Partition into preserved vs replaceable
      const otherCategoryQuestions = kit.questions.filter((q) => q.category !== category);
      const targetCategoryQuestions = kit.questions.filter((q) => q.category === category);

      const preservedQuestions = targetCategoryQuestions.filter(
        (q) => q.state === "edited" || q.state === "pinned"
      );
      const replaceableQuestions = targetCategoryQuestions.filter(
        (q) => q.state === "generated" || !q.state
      );

      // If everything is edited/pinned, leave untouched
      if (replaceableQuestions.length === 0 && preservedQuestions.length > 0) {
        res.status(200).json({
          kit,
          message: `All questions in category '${category}' are edited or pinned and were preserved untouched.`,
        });
        return;
      }

      // Identify linked requirements
      const linkedReqIds = new Set<string>();
      for (const q of replaceableQuestions) {
        for (const rid of q.requirement_ids) {
          linkedReqIds.add(rid);
        }
      }

      let targetReqs = kit.role.requirements.filter((r) => linkedReqIds.has(r.id));
      if (targetReqs.length === 0) {
        targetReqs = kit.role.requirements.slice(0, 2);
      }

      // Generate replacement questions
      const newReplacements = await generateAllQuestions(targetReqs, null);
      const categoryReplacements = newReplacements.map((q, idx) => ({
        ...q,
        id: `q_regen_${Date.now()}_${idx + 1}`,
        category: category as QuestionCategory,
        state: "generated" as const,
      }));

      // Merge: non-target + preserved + replacements
      const mergedCategoryQuestions = [...preservedQuestions, ...categoryReplacements];
      kit.questions = [...otherCategoryQuestions, ...mergedCategoryQuestions];

      // Recompute coverage
      const uncovered = findUncoveredRequirements(kit.role.requirements, kit.questions);
      if (kit.coverage) {
        kit.coverage.uncovered_requirement_ids = uncovered;
      }

      // Reallocate schedule
      const days = kit.schedule?.days_available || 5;
      kit.schedule = allocateSchedule(kit.role.requirements, kit.questions, days);

      // Validate Appendix A shape
      const validation = validateKit(kit.toObject());
      if (!validation.success) {
        res.status(400).json({
          error: {
            code: "INVALID_KIT_STRUCTURE",
            message: "Regenerated kit violates Appendix A structure.",
            details: validation.errors,
          },
        });
        return;
      }

      await kit.save();
      res.status(200).json({
        kit,
        message: `Regenerated category '${category}': preserved ${preservedQuestions.length} edited/pinned questions, replaced ${replaceableQuestions.length} generated questions.`,
      });
      return;
    }

    res.status(400).json({
      error: {
        code: "BAD_REQUEST",
        message: "Specify valid regeneration target: 'company_brief', 'schedule', or 'category'.",
      },
    });
  } catch (error: any) {
    console.error("Sectional regeneration error:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to regenerate section." },
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
