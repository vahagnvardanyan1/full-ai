import type { QAContext, QAAutomationDecision, QAValidationResult } from "../types";
import { QAOpenAIService } from "./openai.service";

const FALLBACK_DECISION: QAAutomationDecision = {
  shouldAutomate: true,
  rationale:
    "Automation is recommended by default to protect behavior and catch regressions.",
  candidateAreas: [],
  manualChecklist: [],
  regressionRisks: [
    "Core user flow may fail after UI logic changes",
    "Edge-case handling may regress silently",
  ],
};

export class QAStrategyService {
  constructor(private readonly openaiService: QAOpenAIService) {}

  decide = async ({
    context,
    validationResult,
  }: {
    context: QAContext;
    validationResult: QAValidationResult;
  }): Promise<QAAutomationDecision> => {
    try {
      const validationSummary = [
        `Validation passed: ${validationResult.passed}`,
        `Validation summary: ${validationResult.summary}`,
        ...validationResult.steps.map(
          (step) =>
            `${step.name}: ${step.passed ? "passed" : "failed"}${
              step.skipped ? ` (skipped: ${step.skipReason || "n/a"})` : ""
            }`,
        ),
      ].join("\n");

      return await this.openaiService.decideAutomationStrategy({
        userMessage: context.requestSummary,
        validationSummary,
      });
    } catch {
      return {
        ...FALLBACK_DECISION,
        candidateAreas: context.extractedFiles.map((file) => file.filePath),
      };
    }
  };
}
