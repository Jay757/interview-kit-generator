import { KitFlashcard, KitRequirement } from "../../types/kit.js";

export interface PracticeAttempt {
  card_id: string;
  confidence: number; // 1 = Again, 2 = Hard, 3 = Good, 4 = Easy
  timestamp: string | Date;
}

export interface CardPracticeMetrics {
  card_id: string;
  repetitions: number;
  easinessFactor: number;
  intervalDays: number;
  lastAttemptAt: Date | null;
  lastConfidence: number | null;
  dueDate: Date | null;
  urgency: number;
  practiced: boolean;
}

export interface PracticeCoverageSummary {
  totalCards: number;
  practicedCardsCount: number;
  unpracticedCardsCount: number;
  cardCoveragePercentage: number;
  practicedCardIds: string[];
  unpracticedCardIds: string[];
  totalRequirementsCount: number;
  coveredRequirementsCount: number;
  uncoveredRequirementsCount: number;
  coveredRequirementIds: string[];
  uncoveredRequirementIds: string[];
  averageConfidence: number;
  confidenceDistribution: {
    1: number; // Again
    2: number; // Hard
    3: number; // Good
    4: number; // Easy
  };
}

/**
 * Calculates SM-2 memory parameters for an individual card based on chronological attempts.
 */
export function computeCardPracticeMetrics(
  cardId: string,
  allAttempts: PracticeAttempt[],
  now: Date = new Date()
): CardPracticeMetrics {
  // Filter attempts for this specific card and sort chronologically
  const cardAttempts = allAttempts
    .filter((a) => a.card_id === cardId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (cardAttempts.length === 0) {
    return {
      card_id: cardId,
      repetitions: 0,
      easinessFactor: 2.5,
      intervalDays: 0,
      lastAttemptAt: null,
      lastConfidence: null,
      dueDate: null,
      urgency: Number.POSITIVE_INFINITY, // Highest priority: unseen cards must be learned
      practiced: false,
    };
  }

  let ef = 2.5;
  let reps = 0;
  let intervalDays = 1;
  let lastAttemptAt: Date = new Date();
  let lastConfidence = 1;

  for (const attempt of cardAttempts) {
    const q = Math.max(1, Math.min(4, Math.round(attempt.confidence)));
    lastConfidence = q;
    lastAttemptAt = new Date(attempt.timestamp);

    if (q === 1) {
      // "Again" - Lapse / Memory failure: reset repetitions to 0, immediate repeat
      reps = 0;
      intervalDays = 0.04; // ~1 hour / immediate review
      ef = Math.max(1.3, ef - 0.2);
    } else if (q === 2) {
      // "Hard" - Struggled with hesitation: interval remains 1 day
      reps = Math.max(1, reps + 1);
      intervalDays = 1;
      ef = Math.max(1.3, ef - 0.15);
    } else if (q === 3) {
      // "Good" - Correct recall with reasonable effort: standard SM-2 expansion
      if (reps === 0) {
        intervalDays = 1;
        reps = 1;
      } else if (reps === 1) {
        intervalDays = 3;
        reps = 2;
      } else {
        intervalDays = Math.round(intervalDays * ef);
        reps++;
      }
    } else if (q === 4) {
      // "Easy" - Flawless recall: aggressive interval expansion + EF boost
      if (reps === 0) {
        intervalDays = 2;
        reps = 1;
      } else if (reps === 1) {
        intervalDays = 5;
        reps = 2;
      } else {
        intervalDays = Math.round(intervalDays * ef * 1.3);
        reps++;
      }
      ef = Math.min(3.0, ef + 0.15);
    }
  }

  const dueDate = new Date(lastAttemptAt.getTime() + intervalDays * 24 * 60 * 60 * 1000);
  const msElapsed = now.getTime() - dueDate.getTime();
  const urgency = msElapsed / (Math.max(intervalDays, 0.1) * 24 * 60 * 60 * 1000);

  return {
    card_id: cardId,
    repetitions: reps,
    easinessFactor: Number(ef.toFixed(2)),
    intervalDays,
    lastAttemptAt,
    lastConfidence,
    dueDate,
    urgency,
    practiced: true,
  };
}

/**
 * Deterministically orders flashcards for the next study session based on SM-2 urgency.
 *
 * Ordering priority:
 * 1. Unseen flashcards (never practiced, urgency = +Infinity) to guarantee requirement syllabus coverage.
 * 2. Overdue or failed cards (rating 1 or 2, urgency > 0, highest urgency first).
 * 3. Due cards.
 * 4. Mastered / future-scheduled cards (lowest urgency last).
 * 5. Deterministic tie-breaker: alphabetical card ID.
 */
export function orderFlashcardsForNextSession(
  flashcards: KitFlashcard[],
  attempts: PracticeAttempt[],
  options?: { now?: Date }
): KitFlashcard[] {
  const now = options?.now || new Date();

  // Precompute metrics for all flashcards
  const metricsMap = new Map<string, CardPracticeMetrics>();
  for (const card of flashcards) {
    metricsMap.set(card.id, computeCardPracticeMetrics(card.id, attempts, now));
  }

  // Clone and sort cards deterministically
  return [...flashcards].sort((a, b) => {
    const metricA = metricsMap.get(a.id)!;
    const metricB = metricsMap.get(b.id)!;

    // Highest urgency first
    if (metricA.urgency !== metricB.urgency) {
      return metricB.urgency - metricA.urgency;
    }

    // Secondary: Lowest recent confidence first
    const confA = metricA.lastConfidence ?? 0;
    const confB = metricB.lastConfidence ?? 0;
    if (confA !== confB) {
      return confA - confB;
    }

    // Tertiary: Stable tie-breaker by card ID
    return a.id.localeCompare(b.id);
  });
}

/**
 * Computes comprehensive coverage metrics for flashcards and mapped requirements.
 */
export function computePracticeCoverage(
  flashcards: KitFlashcard[],
  requirements: KitRequirement[],
  attempts: PracticeAttempt[]
): PracticeCoverageSummary {
  const practicedCardIdsSet = new Set(
    attempts.map((a) => a.card_id).filter((id) => flashcards.some((f) => f.id === id))
  );

  const practicedCardIds = flashcards
    .filter((c) => practicedCardIdsSet.has(c.id))
    .map((c) => c.id);

  const unpracticedCardIds = flashcards
    .filter((c) => !practicedCardIdsSet.has(c.id))
    .map((c) => c.id);

  // Requirements coverage: A requirement is covered if at least one practiced card maps to it
  const practicedReqSet = new Set<string>();
  for (const card of flashcards) {
    if (practicedCardIdsSet.has(card.id) && Array.isArray(card.requirement_ids)) {
      for (const reqId of card.requirement_ids) {
        practicedReqSet.add(reqId);
      }
    }
  }

  const allReqIds = requirements.map((r) => r.id);
  const coveredRequirementIds = allReqIds.filter((id) => practicedReqSet.has(id));
  const uncoveredRequirementIds = allReqIds.filter((id) => !practicedReqSet.has(id));

  // Confidence distribution of latest attempts per card
  const latestConfidencePerCard = new Map<string, number>();
  // Sort attempts by timestamp ascending so later ones overwrite
  const sortedAttempts = [...attempts].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  for (const a of sortedAttempts) {
    if (flashcards.some((f) => f.id === a.card_id)) {
      latestConfidencePerCard.set(a.card_id, Math.max(1, Math.min(4, Math.round(a.confidence))));
    }
  }

  const confidenceDistribution = { 1: 0, 2: 0, 3: 0, 4: 0 };
  let totalConfidenceSum = 0;
  for (const conf of latestConfidencePerCard.values()) {
    if (conf in confidenceDistribution) {
      confidenceDistribution[conf as 1 | 2 | 3 | 4]++;
      totalConfidenceSum += conf;
    }
  }

  const ratedCardsCount = latestConfidencePerCard.size;
  const averageConfidence =
    ratedCardsCount > 0 ? Number((totalConfidenceSum / ratedCardsCount).toFixed(2)) : 0;

  const totalCards = flashcards.length;
  const cardCoveragePercentage =
    totalCards > 0 ? Math.round((practicedCardIds.length / totalCards) * 100) : 0;

  return {
    totalCards,
    practicedCardsCount: practicedCardIds.length,
    unpracticedCardsCount: unpracticedCardIds.length,
    cardCoveragePercentage,
    practicedCardIds,
    unpracticedCardIds,
    totalRequirementsCount: requirements.length,
    coveredRequirementsCount: coveredRequirementIds.length,
    uncoveredRequirementsCount: uncoveredRequirementIds.length,
    coveredRequirementIds,
    uncoveredRequirementIds,
    averageConfidence,
    confidenceDistribution,
  };
}
