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
import { callLLM } from "../pipeline/llm/client.js";

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
import {
  generateKit,
  parseRoleMetadata,
  parseCompanyFromUrl,
} from "../pipeline/orchestrate.js";

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
    const rawDays = days ?? req.body.days_available;
    const daysAvailable =
      typeof rawDays === "number" && rawDays >= 1 ? Math.floor(rawDays) : 5;
    const rawCompanyUrl = companyUrl ?? req.body.company_url;
    const cleanCompanyUrl =
      typeof rawCompanyUrl === "string" && rawCompanyUrl.trim() ? rawCompanyUrl.trim() : "";

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

    // 4. Create initial generating Kit record with seeded role and company metadata
    const roleMeta = parseRoleMetadata(trimmedJd);
    const initialCompany =
      roleMeta.company ||
      (cleanCompanyUrl ? parseCompanyFromUrl(cleanCompanyUrl) : "") ||
      "Target Company";

    const kit = new Kit({
      ownerId: req.session.userId,
      status: "generating",
      generationHash: hash,
      progressStage: "retrieving",
      source: {
        company: initialCompany,
        company_url: cleanCompanyUrl,
        role: roleMeta.title || "Target Role",
        location: roleMeta.location || "",
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
        title: roleMeta.title || "Target Role",
        seniority: roleMeta.seniority || "",
        responsibilities: roleMeta.responsibilities || [],
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
            onProgress: async (stage, partialData) => {
              try {
                const updateDoc: any = { progressStage: stage };
                if (partialData) {
                  if (partialData.source) updateDoc.source = partialData.source;
                  if (partialData.role) updateDoc.role = partialData.role;
                  if (partialData.company_brief) updateDoc.company_brief = partialData.company_brief;
                }
                await Kit.updateOne({ _id: kit._id }, { $set: updateDoc });
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
        const code =
          err?.code ||
          (err?.message?.toLowerCase().includes("quota")
            ? "LLM_QUOTA_EXCEEDED"
            : err?.message?.toLowerCase().includes("rate limit")
            ? "LLM_RATE_LIMITED"
            : "GENERATION_FAILED");
        await Kit.updateOne(
          { _id: kit._id, status: { $ne: "completed" } },
          {
            status: "failed",
            errorCode: code,
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
      "_id ownerId status progressStage errorMessage createdAt updatedAt source role company_brief"
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

    // Auto-detect stalled/interrupted generation (e.g. server was restarted mid-process)
    if (
      kit.status === "generating" &&
      kit.updatedAt &&
      Date.now() - new Date(kit.updatedAt).getTime() > 180000
    ) {
      kit.status = "failed";
      kit.errorCode = "GENERATION_TIMED_OUT";
      kit.errorMessage =
        "Generation was interrupted or timed out. Please try creating a new kit.";
      await Kit.updateOne(
        { _id: kit._id },
        {
          $set: {
            status: "failed",
            errorCode: "GENERATION_TIMED_OUT",
            errorMessage: kit.errorMessage,
          },
        }
      );
    }

    res.status(200).json({
      kitId: kit._id,
      status: kit.status,
      stage: kit.progressStage || "starting",
      errorMessage: kit.errorMessage,
      errorCode: kit.errorCode,
      error: kit.errorMessage
        ? {
            code: kit.errorCode || "GENERATION_FAILED",
            message: kit.errorMessage,
          }
        : undefined,
      updatedAt: kit.updatedAt,
      createdAt: kit.createdAt,
      source: kit.source,
      role: kit.role,
      company_brief: kit.company_brief,
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

    // Auto-detect stalled/interrupted generation
    if (
      kit.status === "generating" &&
      kit.updatedAt &&
      Date.now() - new Date(kit.updatedAt).getTime() > 180000
    ) {
      kit.status = "failed";
      kit.errorCode = "GENERATION_TIMED_OUT";
      kit.errorMessage =
        "Generation was interrupted or timed out. Please try creating a new kit.";
      await Kit.updateOne(
        { _id: kit._id },
        {
          $set: {
            status: "failed",
            errorCode: "GENERATION_TIMED_OUT",
            errorMessage: kit.errorMessage,
          },
        }
      );
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

    // 4. Target: Flashcards regeneration
    if (target === "flashcards") {
      const preservedCards = (kit.flashcards || []).filter(
        (c) => c.state === "edited" || c.state === "pinned"
      );
      const newCards = await generateFlashcards(kit.questions || []);
      const finalCards = [
        ...preservedCards,
        ...newCards.map((c, i) => ({
          ...c,
          id: `f_regen_${Date.now()}_${i + 1}`,
          state: "generated" as const,
        })),
      ];
      kit.flashcards = finalCards;
      await kit.save();
      res.status(200).json({
        kit,
        message: `Flashcards regenerated: preserved ${preservedCards.length} edited/pinned cards, generated ${newCards.length} new cards.`,
      });
      return;
    }

    res.status(400).json({
      error: {
        code: "BAD_REQUEST",
        message: "Specify valid regeneration target: 'company_brief', 'schedule', 'category', or 'flashcards'.",
      },
    });
  } catch (error: any) {
    console.error("Sectional regeneration error:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to regenerate section." },
    });
  }
});

import {
  orderFlashcardsForNextSession,
  computePracticeCoverage,
} from "../pipeline/practice/ordering.js";

// GET /kits/:id/practice - Get adaptive ordered flashcards and practice coverage
router.get("/:id/practice", async (req: Request, res: Response) => {
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

    const attempts = kit.practice_attempts || [];
    const orderedFlashcards = orderFlashcardsForNextSession(kit.flashcards || [], attempts);
    const coverage = computePracticeCoverage(
      kit.flashcards || [],
      kit.role?.requirements || [],
      attempts
    );

    res.status(200).json({
      kit_id: kit._id,
      role: kit.role?.title || "Role",
      company: kit.source?.company || "Company",
      questions: kit.questions || [],
      schedule: kit.schedule,
      flashcards: orderedFlashcards,
      coverage,
      attempts,
    });
  } catch (error: any) {
    console.error("Get practice mode error:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred while loading practice mode.",
      },
    });
  }
});

// POST /kits/:id/practice/attempt - Record confidence rating for a flashcard attempt
router.post("/:id/practice/attempt", async (req: Request, res: Response) => {
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
          message: "You do not have permission to modify this kit.",
        },
      });
      return;
    }

    const { card_id, confidence } = req.body;

    if (!card_id || typeof card_id !== "string") {
      res.status(400).json({
        error: {
          code: "INVALID_REQUEST",
          message: "card_id is required.",
        },
      });
      return;
    }

    const confNum = Number(confidence);
    if (![1, 2, 3, 4].includes(confNum)) {
      res.status(400).json({
        error: {
          code: "INVALID_REQUEST",
          message: "confidence must be an integer between 1 and 4.",
        },
      });
      return;
    }

    // Ensure card exists in kit
    const cardExists = (kit.flashcards || []).some((c) => c.id === card_id);
    if (!cardExists) {
      res.status(400).json({
        error: {
          code: "CARD_NOT_FOUND",
          message: `Flashcard with id '${card_id}' does not exist in this kit.`,
        },
      });
      return;
    }

    if (!Array.isArray(kit.practice_attempts)) {
      kit.practice_attempts = [];
    }

    const attempt = {
      card_id,
      confidence: confNum,
      timestamp: new Date().toISOString(),
    };

    kit.practice_attempts.push(attempt);
    await kit.save();

    const coverage = computePracticeCoverage(
      kit.flashcards || [],
      kit.role?.requirements || [],
      kit.practice_attempts
    );

    res.status(200).json({
      status: "ok",
      attempt,
      coverage,
    });
  } catch (error: any) {
    console.error("Record practice attempt error:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An error occurred while saving practice attempt.",
      },
    });
  }
});

// POST /kits/:id/practice/evaluate-answer - AI scoring & constructive feedback on candidate response
router.post("/:id/practice/evaluate-answer", async (req: Request, res: Response) => {
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
      res.status(403).json({ error: { code: "FORBIDDEN", message: "Unauthorized access." } });
      return;
    }

    const { question_id, user_answer } = req.body;
    if (!question_id || !user_answer || typeof user_answer !== "string" || !user_answer.trim()) {
      res.status(400).json({
        error: { code: "BAD_REQUEST", message: "question_id and a non-empty user_answer are required." },
      });
      return;
    }

    const question = (kit.questions || []).find((q) => q.id === question_id);
    if (!question) {
      res.status(404).json({
        error: { code: "QUESTION_NOT_FOUND", message: `Question '${question_id}' not found in kit.` },
      });
      return;
    }

    // Anti-cheat / Prompt-echo guard: If candidate pasted the prompt back, score honestly as No Hire
    const cleanedAnswer = user_answer.trim().toLowerCase();
    const cleanedPrompt = question.prompt.trim().toLowerCase();
    if (
      cleanedAnswer === cleanedPrompt ||
      (cleanedPrompt.length > 30 && cleanedAnswer.includes(cleanedPrompt.slice(0, 50)))
    ) {
      res.status(200).json({
        success: true,
        question_id,
        evaluation: {
          score: 12,
          verdict: "No Hire",
          summary: "Candidate repeated the interview question prompt without providing an architectural answer or solution.",
          strengths: ["Scenario prompt was accurately cited."],
          improvements: [
            "Do not paste or echo the question prompt back into the response field.",
            "Outline your concrete technical approach, architecture boundaries, schemas, and trade-offs.",
            "Demonstrate hands-on domain mastery and real-world production considerations."
          ],
          modelAnswer: question.answer_outline
        }
      });
      return;
    }

    const systemPrompt = `You are a Principal Technical Interview Bar Raiser evaluating a candidate's answer.
Analyze the candidate's written response against the interview question and industry benchmarks.
Return STRICT JSON ONLY, with this schema:
{
  "score": number (integer between 0 and 100),
  "verdict": "Strong Hire" | "Hire" | "Leaning Hire" | "Needs Improvement" | "No Hire",
  "summary": "1-2 sentence executive verdict",
  "strengths": ["string", "string"],
  "improvements": ["string", "string", "string"],
  "modelAnswer": "An exact, comprehensive, high-scoring exemplar response demonstrating how an elite L6/Staff candidate should answer this question, including specific architecture, metrics, and trade-offs."
}`;

    const userPrompt = `Target Company: ${kit.source.company || "Company"}
Role: ${kit.role.title} (${kit.role.seniority || "Senior"})
Category: ${question.category}
Difficulty: Level ${question.difficulty}
Question Prompt: "${question.prompt}"
Reference Answer Outline: ${question.answer_outline || "Demonstrate clear technical depth, STAR framework, and metric impact."}

Candidate's Answer:
"${user_answer.trim()}"`;

    let evaluationResult;
    try {
      const llmRes = await callLLM(systemPrompt, userPrompt, { jsonMode: true, temperature: 0.2 });
      evaluationResult = JSON.parse(llmRes.text);
    } catch (llmErr: any) {
      console.error("[evaluate-answer] LLM call failed:", llmErr?.message);
      const isQuota =
        llmErr?.status === 429 ||
        llmErr?.message?.includes("quota") ||
        llmErr?.message?.includes("Rate limit");

      if (isQuota) {
        res.status(429).json({
          error: {
            code: "LLM_RATE_LIMIT",
            message:
              "AI Quota Exceeded: Your OpenRouter free daily quota has been reached (Rate limit exceeded: free-models-per-day). Please use an API key with active credits or wait for the daily reset.",
          },
        });
        return;
      }

      res.status(500).json({
        error: {
          code: "LLM_ERROR",
          message: llmErr?.message || "Failed to evaluate answer via AI.",
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      question_id,
      evaluation: evaluationResult,
    });
  } catch (err: any) {
    console.error("Evaluate answer error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to evaluate answer." } });
  }
});

// POST /kits/:id/practice/generate-answer - On-demand comprehensive Staff-level model answer generation
router.post("/:id/practice/generate-answer", async (req: Request, res: Response) => {
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
      res.status(403).json({ error: { code: "FORBIDDEN", message: "Unauthorized access." } });
      return;
    }

    const { question_id } = req.body;
    if (!question_id) {
      res.status(400).json({
        error: { code: "BAD_REQUEST", message: "question_id is required." },
      });
      return;
    }

    const question = (kit.questions || []).find((q) => q.id === question_id);
    if (!question) {
      res.status(404).json({
        error: { code: "QUESTION_NOT_FOUND", message: `Question '${question_id}' not found in kit.` },
      });
      return;
    }

    const systemPrompt = `You are a Staff Engineering Bar Raiser at a tier-1 tech company.
Generate an elite, comprehensive exemplar interview response for the specified question.
Structure the answer clearly:
1. Core Approach & Architecture: Direct high-level answer and architectural philosophy.
2. Technical Execution & Deep Dive: Specific mechanics, algorithms, schemas, or protocols.
3. Trade-offs & Alternatives: Honest discussion of trade-offs (e.g. latency vs consistency, complexity vs velocity).
4. Production Failure Modes: Edge cases, retry storms, partition handling, and telemetry.
Keep it practical, professional, and detailed. Do not use generic conversational filler.`;

    const userPrompt = `Target Company: ${kit.source.company || "Target Company"}
Role: ${kit.role.title} (${kit.role.seniority || "Senior"})
Category: ${question.category}
Difficulty: Level ${question.difficulty}
Question: "${question.prompt}"
Baseline Rubric: ${question.answer_outline}`;

    let modelAnswerText = "";
    try {
      const llmRes = await callLLM(systemPrompt, userPrompt, { temperature: 0.3 });
      modelAnswerText = llmRes.text.trim();
    } catch (llmErr: any) {
      console.warn("[generate-answer] LLM call failed, generating category-aware rubric exemplar:", llmErr?.message);

      const categoryTitle =
        question.category === "system-design"
          ? "System Architecture & Scalability"
          : question.category === "behavioural"
          ? "STAR Leadership & Communication"
          : question.category === "company-fit"
          ? "Mission Alignment & Ownership"
          : "Technical Execution & Problem Solving";

      const productionPoints =
        question.category === "system-design"
          ? "- Latency & throughput targets (e.g. p99 < 50ms, graceful backpressure)\n- Failure domains, partition tolerance, and dead-letter queueing\n- Observability: Distributed tracing, Prometheus metrics, and automated alerts"
          : question.category === "behavioural" || question.category === "company-fit"
          ? "- Cross-functional stakeholder communication and transparent trade-offs\n- Measurable impact metrics on team velocity, delivery, or incident frequency\n- Retrospective learnings and long-term organizational value"
          : "- Robust type safety, component modularity, and explicit state boundaries\n- Test coverage (unit, integration) and regression prevention\n- Developer ergonomics, clean abstractions, and zero-downtime migration";

      modelAnswerText = `[Staff/Principal Exemplar: ${categoryTitle}]

1. Core Strategy & Direct Approach:
Lead with an executive summary that demonstrates seniority and sound technical judgment. Frame the problem in terms of constraints, business impact, and key architectural trade-offs before diving into low-level details.

2. Technical Execution:
${question.answer_outline || "Structure the solution around atomic requirements, explicit interfaces, and defensive architecture."}

3. Production Considerations & Trade-offs:
${productionPoints}`;
    }

    res.status(200).json({
      success: true,
      question_id,
      model_answer: modelAnswerText,
    });
  } catch (err: any) {
    console.error("Generate model answer error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to generate model answer." } });
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
