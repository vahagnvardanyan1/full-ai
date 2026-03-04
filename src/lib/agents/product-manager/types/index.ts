// ──────────────────────────────────────────────────────────
// Product Manager Agent — Type Definitions
//
// PM-specific types. These do NOT modify any shared types
// in ../types.ts — they are internal to the PM pipeline.
// ──────────────────────────────────────────────────────────

// ── Core PM Types (existing) ─────────────────────────────

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
  category: "technical" | "scope" | "dependency" | "performance" | "security" | "design";
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
  /** Design system extracted from tailwind config, globals.css, theme files */
  designSystem?: DesignSystemSnapshot;
}

// ── Deep Thinking & Creative Analysis Types (v4) ─────────

/**
 * Deep thinking output — the PM's reasoning about the problem
 * BEFORE jumping into requirements or task planning.
 *
 * This forces the LLM to reason about what the user actually
 * needs, analyze current state, and consider alternatives —
 * rather than immediately decomposing into tasks.
 */
export interface PMThinkingAnalysis {
  /** What the user ACTUALLY needs (may differ from what they literally said) */
  problemStatement: string;
  /** Analysis of what exists now — based on reading actual component code */
  currentStateAnalysis: string;
  /** How users currently interact with the affected feature, and how they should */
  userJourney: string;
  /** What's missing, broken, or suboptimal in the current implementation */
  gaps: string[];
  /** What we're assuming about the request (to be validated) */
  assumptions: string[];
  /** High-level creative direction the PM is proposing */
  proposedApproach: string;
  /** Other approaches considered and why they were rejected */
  alternativesConsidered: string[];
}

/**
 * Design analysis extracted from actual component code.
 * The PM reads each related component and extracts its visual DNA.
 */
export interface ComponentAnalysis {
  /** Path to the component file */
  filePath: string;
  /** Color values found — hex codes, Tailwind classes (bg-*, text-*, border-*) */
  colors: string[];
  /** Typography classes/styles — font families, sizes, weights */
  typography: string[];
  /** Spacing classes/values — padding, margin, gap */
  spacing: string[];
  /** Primary layout pattern used */
  layoutPattern: string;
  /** Responsive breakpoints in use (sm:, md:, lg:, specific px values) */
  responsiveBreakpoints: string[];
  /** Interaction patterns — hover states, transitions, animations */
  interactionPatterns: string[];
  /** Accessibility attributes — ARIA labels, semantic HTML elements, roles */
  accessibility: string[];
}

/**
 * Extracted design system snapshot from the repo's config files.
 * Sources: tailwind.config, globals.css, CSS variables, theme files.
 */
export interface DesignSystemSnapshot {
  /** Named colors from the config/theme — e.g. { "primary": "#00d9ff", "bg-dark": "#1a1a1a" } */
  colors: Record<string, string>;
  /** Typography tokens — e.g. { "heading": "font-bold text-2xl", "body": "font-normal text-base" } */
  typography: Record<string, string>;
  /** Spacing scale values found */
  spacing: string[];
  /** Responsive breakpoints — e.g. { "sm": "640px", "md": "768px" } */
  breakpoints: Record<string, string>;
  /** Where this was extracted from */
  source: string;
}

/**
 * Creative design proposal — a specific visual change the PM is
 * proposing for a component, with full rationale and specs.
 *
 * This is what makes the PM "creative" — it doesn't just say
 * "redesign the footer," it says "use #1a1a1a background because
 * it matches the brand secondary palette and creates visual separation."
 */
export interface DesignProposal {
  /** Which component this proposal targets */
  component: string;
  /** Description of what currently exists — "Black bg, white text, no hover states" */
  currentState: string;
  /** Description of what we're proposing — "Dark charcoal bg, brand accent links" */
  proposedChanges: string;
  /** Specific visual specs for the developer */
  visualSpecs: {
    colors?: Record<string, string>;
    typography?: string;
    spacing?: string;
    layout?: string;
    interactions?: string;
    responsive?: string;
    accessibility?: string;
  };
  /** WHY this design choice — references brand, trends, accessibility, user needs */
  rationale: string;
  /** Which files need to be modified */
  affectedFiles: string[];
}

/**
 * Enriched task plan that includes design specifications.
 * Extends the base PMTaskPlan with visual details so the
 * developer knows EXACTLY what to build.
 */
export interface EnrichedPMTaskPlan extends PMTaskPlan {
  /** Full design proposal for this task (if visual changes are involved) */
  designSpecs?: DesignProposal;
  /** Visual-specific acceptance criteria — "Footer bg uses #1a1a1a" */
  visualAcceptanceCriteria?: string[];
  /** Explanation of WHY these design choices were made */
  designRationale?: string;
}

// ── Progress Stages ──────────────────────────────────────

/** Progress stages emitted by the PM pipeline (v4 — includes creative stages) */
export type PMProgressStage =
  | "gathering_context"
  | "deep_analysis"
  | "design_analysis"
  | "creative_reasoning"
  | "analyzing_requirements"
  | "assessing_feasibility"
  | "planning_tasks"
  | "writing_stories"
  | "assessing_risks"
  | "creating_tasks"
  | "complete";
