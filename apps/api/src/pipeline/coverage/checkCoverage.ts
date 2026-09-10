import { KitCoverage, Question, Requirement } from "../../types/kit.js";

const DEFAULT_MAX_PASSES = 3;

/**
 * Finds all requirement IDs that do not appear in any question's requirement_ids array.
 * Pure set logic, 0% LLM.
 */
export function findUncoveredRequirements(
  requirements: Requirement[],
  questions: Question[]
): string[] {
  const coveredSet = new Set<string>();

  for (const q of questions) {
    if (Array.isArray(q.requirement_ids)) {
      for (const reqId of q.requirement_ids) {
        coveredSet.add(reqId);
      }
    }
  }

  return requirements
    .filter((r) => !coveredSet.has(r.id))
    .map((r) => r.id);
}

export interface CoverageLoopResult {
  questions: Question[];
  coverage: KitCoverage;
}

/**
 * Runs the deterministic coverage verification loop.
 * If any MUST requirements are uncovered after draft generation, it invokes
 * the gap-filling generator callback only for the missing requirements.
 * Lingering NICE requirements are reported honestly in uncovered_requirement_ids.
 */
export async function runCoverageLoop(
  requirements: Requirement[],
  initialQuestions: Question[],
  gapFillGenerator: (uncoveredReqs: Requirement[]) => Promise<Question[]>,
  maxPasses: number = DEFAULT_MAX_PASSES
): Promise<CoverageLoopResult> {
  let questions = [...initialQuestions];
  let passes = 1;

  const reqMap = new Map<string, Requirement>();
  for (const r of requirements) {
    reqMap.set(r.id, r);
  }

  while (passes <= maxPasses) {
    const uncoveredIds = findUncoveredRequirements(requirements, questions);

    // Filter only MUST requirements that need gap-filling
    const uncoveredMustReqs = uncoveredIds
      .map((id) => reqMap.get(id)!)
      .filter((r) => r && r.priority === "must");

    // If all MUST requirements are covered, or we hit maxPasses, finish loop
    if (uncoveredMustReqs.length === 0 || passes >= maxPasses) {
      break;
    }

    // Invoke gap-filling callback
    passes++;
    try {
      const newQuestions = await gapFillGenerator(uncoveredMustReqs);
      questions.push(...newQuestions);
    } catch (err) {
      console.warn(`Coverage loop pass ${passes} gap-fill call failed:`, err);
      break;
    }
  }

  // Final honest coverage calculation (includes any remaining nice requirements)
  const finalUncoveredIds = findUncoveredRequirements(requirements, questions);

  return {
    questions,
    coverage: {
      uncovered_requirement_ids: finalUncoveredIds,
      passes,
    },
  };
}
