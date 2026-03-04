export type QAProgressStage =
  | "gathering_context"
  | "planning_strategy"
  | "running_validation"
  | "executing_qa"
  | "reporting"
  | "complete";

export interface QARunInput {
  userMessage: string;
}

export interface QAExtractedFile {
  filePath: string;
  language: string;
  description: string;
  code: string;
}

export interface QAContext {
  requestSummary: string;
  extractedFiles: QAExtractedFile[];
}

export interface QAAutomationDecision {
  shouldAutomate: boolean;
  rationale: string;
  candidateAreas: string[];
  manualChecklist: string[];
  regressionRisks: string[];
}

export interface QAValidationStep {
  name: string;
  command: string;
  passed: boolean;
  output: string;
  skipped?: boolean;
  skipReason?: string;
}

export interface QAValidationResult {
  passed: boolean;
  summary: string;
  steps: QAValidationStep[];
}
