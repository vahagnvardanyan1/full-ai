// ──────────────────────────────────────────────────────────
// V3 Type Definitions — from ai-engineer-agent-v3
// ──────────────────────────────────────────────────────────

export interface RepoKnowledge {
  repoFullName: string;
  language: string;
  framework: string;
  buildSystem: string;
  testFramework: string;
  linter: string;
  conventions: string[];
  architecture: string;
  keyFiles: Record<string, string>;
  dependencies: string[];
  /** Key linter/formatter rules extracted from project config (e.g. eslint, prettier) */
  linterRules: string[];
  lastUpdated: Date;
}

export interface RepoInfo {
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
}

export interface IssueInfo {
  number: number;
  title: string;
  body: string;
  labels: string[];
  author: string;
}

export interface TaskPlan {
  summary: string;
  steps: PlanStep[];
  estimatedFiles: string[];
  risks: string[];
  approach: string;
}

export interface PlanStep {
  order: number;
  description: string;
  action: "create" | "modify" | "delete" | "test" | "review";
  targetFile?: string;
  details: string;
}

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CodeGenerationRequest {
  task: string;
  context: string;
  existingCode?: string;
  language?: string;
  constraints?: string[];
}

export interface CodeGenerationResponse {
  code: string;
  explanation: string;
  filename: string;
  language: string;
}

export interface ValidationResult {
  passed: boolean;
  steps: ValidationStep[];
  summary: string;
}

export interface ValidationStep {
  name: string;
  passed: boolean;
  output: string;
  duration: number;
  skipped?: boolean;
  skipReason?: string;
}

export interface FileContext {
  targetFile: string;
  existingCode?: string;
  importedBy: { filename: string; snippet: string }[];
  imports: { filename: string; snippet: string }[];
  relatedTests: { filename: string; snippet: string }[];
  siblingFiles: { filename: string; snippet: string }[];
  conventionsSummary: string;
}

export interface ImpactReport {
  directImpact: string[];
  downstreamImpact: string[];
  affectedTests: string[];
  riskLevel: "low" | "medium" | "high" | "critical";
  summary: string;
  warnings: string[];
}

export interface GitHubConfig {
  token: string;
}

export interface OpenAIConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
}

export interface CacheConfig {
  enabled: boolean;
  repoContextTTL: number;
  llmResponseTTL: number;
  maxEntries: number;
}

export interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: number;
  ttl: number;
  hits: number;
}
