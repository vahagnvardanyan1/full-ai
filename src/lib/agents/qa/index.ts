import type { AgentResponse } from "../types";
import { QAContextService } from "./services/context.service";
import { QAOpenAIService } from "./services/openai.service";
import { QAReportService } from "./services/report.service";
import { QAStrategyService } from "./services/strategy.service";
import { QAValidatorService } from "./services/validator.service";
import type {
  QAAutomationDecision,
  QAProgressStage,
  QAValidationResult,
} from "./types";

/** Callback for QA sub-step progress events */
export type QAProgressCallback = (
  stage: QAProgressStage,
  message: string,
  progress: number,
) => void;

const buildAutomationPrompt = (sharedContext: string): string =>
  [
    sharedContext,
    "",
    "## YOUR EXECUTION MODE: AUTOMATION (PR with tests)",
    "",
    "Strict policy: no mocks/stubs/fake data in any test file.",
    "",
    "Actions required:",
    "1. Write real, runnable test files covering the changed behavior.",
    "2. Push tests via QA branch (pattern: qa/<frontend-branch>-tests).",
    "3. Open a PR against the frontend feature branch provided by orchestrator.",
    '4. Call create_github_pull_request with created_by set to "qa" to commit only QA-generated files.',
    "5. PR body must include: validation summary, regression risks, test coverage rationale.",
    "6. Soft-gate behavior: report failures clearly, do not claim merge is blocked.",
    "7. Call update_task_status to set status to 'done' after all artifacts are created.",
  ].join("\n");

const buildIssueVerificationPrompt = ({
  sharedContext,
  decision,
  validationResult,
  validationStepLines,
}: {
  sharedContext: string;
  decision: QAAutomationDecision;
  validationResult: QAValidationResult;
  validationStepLines: string;
}): string => {
  const failedSteps = validationResult.steps.filter(
    (step) => !step.skipped && !step.passed,
  );
  const hasFailures = failedSteps.length > 0;

  return [
    sharedContext,
    "",
    "## YOUR EXECUTION MODE: ISSUE-BASED VERIFICATION (no PR)",
    "",
    "Automation was determined NOT required. You must create a thorough GitHub issue",
    "that serves as the QA artifact for this change. This issue must be specific,",
    "actionable, and comprehensive — not a generic template.",
    "",
    "### STRICT CONSTRAINTS",
    "- Do NOT call write_code (no test files).",
    "- Do NOT call create_github_pull_request (no PR).",
    "- You MUST call create_github_issue with a fully structured body.",
    "- You MUST call update_task_status to set status to 'done' after the issue is created.",
    "",
    "### ISSUE STRUCTURE REQUIREMENTS",
    "",
    'Title format: "QA: [Change Type] — [Scope]"',
    "  Examples: 'QA: Styling — Header responsive layout update'",
    "           'QA: Refactor — Extract shared Button component'",
    "           'QA: Feature — Add user profile avatar upload'",
    '  Labels: ["qa", "verification"]',
    "",
    "The issue body MUST contain ALL of the following sections:",
    "",
    "#### 1. Change Analysis",
    "- Classify the change type (feature / bugfix / refactor / styling / config / dependency / other)",
    "- List every file modified with a one-line description of what changed",
    "- Describe the user-facing impact (what the user sees differently, or 'internal only')",
    "",
    "#### 2. Validation Gate Results",
    "Include the actual pipeline results:",
    validationStepLines,
    hasFailures
      ? `\nIMPORTANT: There are ${failedSteps.length} failing gate(s). Your issue MUST include root-cause analysis for each failure and whether they are pre-existing or introduced by this change.`
      : "",
    "",
    "#### 3. Regression Risk Assessment",
    "For each risk, reference specific files, components, or user flows:",
    decision.regressionRisks.length > 0
      ? decision.regressionRisks.map((risk) => `- ${risk}`).join("\n")
      : "- Analyze the actual files changed and identify what existing behavior could break.",
    "",
    "#### 4. Manual Verification Checklist",
    "Write step-by-step instructions adapted to the change type:",
    "- For styling changes: visual checks, responsive breakpoints, dark mode, browser compatibility",
    "- For logic changes: user flow walkthroughs, input edge cases, error state handling",
    "- For refactors: before/after behavior parity, import chain integrity, no missing exports",
    "- For features: full happy path, permission/auth edge cases, loading/error states",
    "Each item must be concrete: specify routes, UI elements, expected outcomes.",
    decision.manualChecklist.length > 0
      ? `\nPreliminary items from strategy analysis (expand and refine these):\n${decision.manualChecklist.map((item) => `- ${item}`).join("\n")}`
      : "",
    "",
    "#### 5. Automation Rationale",
    `Strategy decision rationale: ${decision.rationale}`,
    "Expand on this: explain what conditions would trigger adding automation in the future",
    "(e.g., 'if this component gains stateful behavior, add integration tests').",
    "",
    "#### 6. QA Recommendation",
    "Provide a clear verdict: PASS / CONDITIONAL PASS / FAIL",
    "- PASS: all gates green, low risk, no manual follow-up needed beyond routine review",
    "- CONDITIONAL PASS: gates green but manual verification of specific items is recommended before merge",
    "- FAIL: gates failed or high regression risk identified — merge should wait for resolution",
  ].join("\n");
};

export const runQAAgent = async (
  userMessage: string,
  onProgress?: QAProgressCallback,
): Promise<AgentResponse> => {
  const emit = onProgress ?? (() => {});

  const contextService = new QAContextService();
  const openaiService = new QAOpenAIService();
  const strategyService = new QAStrategyService(openaiService);
  const validatorService = new QAValidatorService();
  const reportService = new QAReportService();

  emit("gathering_context", "Analyzing frontend output and QA scope...", 8);
  const context = contextService.extractContext({ userMessage });

  emit("running_validation", "Running real validation gates for regressions...", 30);
  const validationResult = await validatorService.run({
    projectDir: process.cwd(),
  });

  emit("planning_strategy", "Choosing automation strategy and risk focus...", 55);
  const decision = await strategyService.decide({
    context,
    validationResult,
  });

  const validationStepLines = validationResult.steps
    .map(
      (step) =>
        `- ${step.name}: ${
          step.skipped
            ? `skipped (${step.skipReason || "n/a"})`
            : step.passed
              ? "passed"
              : "FAILED"
        }${!step.skipped && !step.passed && step.output ? ` — ${step.output.slice(0, 200)}` : ""}`,
    )
    .join("\n");

  const fileListBlock =
    context.extractedFiles.length > 0
      ? context.extractedFiles
          .map((file) => `- ${file.filePath} (${file.language}): ${file.description}`)
          .join("\n")
      : "- No generated files provided to QA context.";

  const sharedContext = [
    "## QA Pipeline Context",
    "",
    "### Request Summary",
    context.requestSummary,
    "",
    "### Frontend Files Under Review",
    fileListBlock,
    "",
    "### Validation Gate Results",
    `Overall: ${validationResult.passed ? "PASSED" : "FAILED"}`,
    `Summary: ${validationResult.summary}`,
    validationStepLines,
    "",
    "### Strategy Analysis",
    `Automation decision: ${decision.shouldAutomate ? "REQUIRED" : "NOT REQUIRED"}`,
    `Rationale: ${decision.rationale}`,
    "",
    "### Identified Risk Areas",
    decision.candidateAreas.length > 0
      ? decision.candidateAreas.map((item) => `- ${item}`).join("\n")
      : "- No specific candidate areas identified",
    "",
    "### Regression Risks",
    decision.regressionRisks.length > 0
      ? decision.regressionRisks.map((item) => `- ${item}`).join("\n")
      : "- No specific regression risks identified",
    "",
    "### Preliminary Manual Checklist",
    decision.manualChecklist.length > 0
      ? decision.manualChecklist.map((item) => `- ${item}`).join("\n")
      : "- No preliminary checklist items from strategy phase",
  ].join("\n");

  const strategyPrompt = decision.shouldAutomate
    ? buildAutomationPrompt(sharedContext)
    : buildIssueVerificationPrompt({ sharedContext, decision, validationResult, validationStepLines });

  const progressMessage = decision.shouldAutomate
    ? "Executing autonomous QA (automation + PR path)..."
    : "Executing autonomous QA (issue-based verification path)...";
  emit("executing_qa", progressMessage, 72);
  const agentResponse = await openaiService.run({
    userMessage: `${userMessage}\n\n${strategyPrompt}`,
  });

  emit("reporting", "Building structured QA report...", 92);
  const report = reportService.build({
    context,
    decision,
    validation: validationResult,
    agentResponse,
  });

  emit("complete", "QA verification finished.", 100);
  return report;
};
