// ──────────────────────────────────────────────────────────
// Product Manager Agent — Type Definitions
//
// PM-specific types. These do NOT modify any shared types
// in ../types.ts — they are internal to the PM pipeline.
// ──────────────────────────────────────────────────────────

/** Structured PRD output from requirements analysis */
export interface PRDDocument {
  summary: string;
  goals: string[];
  userPersonas: string[];
  scope: string;
  outOfScope: string;
  successMetrics: string[];
  acceptanceCriteria: AcceptanceCriterion[];
}

/** Single acceptance criterion — testable and unambiguous */
export interface AcceptanceCriterion {
  id: string;
  description: string;
  testable: boolean;
  priority: "must" | "should" | "nice";
}

/** Technical feasibility assessment */
export interface FeasibilityReport {
  /** 1-5 scale: 1=trivial, 5=very complex */
  complexity: number;
  estimatedHours: number;
  risks: string[];
  technicalConstraints: string[];
  recommendation: string;
  /** Which existing files are affected */
  affectedFiles: string[];
}

/** Full user story in standard format */
export interface UserStory {
  asA: string;
  iWant: string;
  soThat: string;
  acceptanceCriteria: string[];
  edgeCases: string[];
  priority: "high" | "medium" | "low";
  estimate: string;
}

/** Enriched task plan with dependencies */
export interface PMTaskPlan {
  title: string;
  description: string;
  type: "task" | "story" | "bug";
  priority: "high" | "medium" | "low";
  assignedTo: "frontend_developer" | "qa" | "devops";
  dependencies: string[];
  acceptanceCriteria: string[];
  estimate: string;
  /** User story associated with this task (if any) */
  story?: UserStory;
}

/** Risk item identified during planning */
export interface RiskItem {
  category: "technical" | "scope" | "dependency" | "performance" | "security";
  description: string;
  probability: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  mitigation: string;
}

/** Quality gate for validating agent output */
export interface QualityGate {
  taskTitle: string;
  criteria: string[];
  validationMethod: string;
}

/** Internal pipeline state — not exposed to orchestrator */
export interface PMPipelineResult {
  prd: PRDDocument;
  feasibility: FeasibilityReport;
  stories: UserStory[];
  tasks: PMTaskPlan[];
  risks: RiskItem[];
  qualityGates: QualityGate[];
}

/** Repo context gathered by the PM */
export interface PMRepoContext {
  repoFullName: string;
  defaultBranch: string;
  fileTree: string[];
  techStack: string;
  existingPages: string[];
  existingComponents: string[];
  configFiles: string[];
  packageDeps: string[];
}

/** Progress stages emitted by the PM pipeline */
export type PMProgressStage =
  | "gathering_context"
  | "analyzing_requirements"
  | "assessing_feasibility"
  | "planning_tasks"
  | "writing_stories"
  | "assessing_risks"
  | "creating_tasks"
  | "complete";
