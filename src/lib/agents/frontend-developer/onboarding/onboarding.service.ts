// ──────────────────────────────────────────────────────────
// Onboarding Service — from ai-engineer-agent-v3
// Auto-learns repo patterns (language, framework, conventions)
// ──────────────────────────────────────────────────────────

import { createChildLogger } from "../utils/logger";
import { OpenAIService } from "../services/openai.service";
import { GitHubService } from "../services/github.service";
import { CacheService } from "../cache/cache.service";
import type { RepoKnowledge, RepoInfo } from "../types";

const log = createChildLogger("onboarding");

export class OnboardingService {
  private openai: OpenAIService;
  private github: GitHubService;
  private cache: CacheService;

  constructor(openai: OpenAIService, github: GitHubService, cache: CacheService) {
    this.openai = openai;
    this.github = github;
    this.cache = cache;
  }

  async getKnowledge(repo: RepoInfo): Promise<RepoKnowledge> {
    const cached = await this.cache.getRepoKnowledge(repo.fullName);
    if (cached) {
      log.info({ repo: repo.fullName }, "Using cached repo knowledge");
      return cached;
    }

    log.info({ repo: repo.fullName }, "Onboarding new repository...");
    const knowledge = await this.analyzeRepo(repo);
    await this.cache.setRepoKnowledge(repo.fullName, knowledge);
    log.info({ repo: repo.fullName, lang: knowledge.language }, "Repo onboarded");

    return knowledge;
  }

  private async analyzeRepo(repo: RepoInfo): Promise<RepoKnowledge> {
    const repoInfo = await this.github.getRepoInfo();
    const tree = await this.github.getRepoTree(repoInfo.defaultBranch);

    // Gather key files
    const keyFileNames = [
      "package.json", "tsconfig.json", "Cargo.toml", "go.mod", "pyproject.toml",
      "requirements.txt", "Gemfile", "pom.xml", "build.gradle",
      ".eslintrc.json", ".eslintrc.js", ".prettierrc",
      "jest.config.js", "jest.config.ts", "vitest.config.ts",
      ".github/workflows/ci.yml", ".github/workflows/ci.yaml",
      "Dockerfile", "docker-compose.yml",
      "README.md", "CONTRIBUTING.md", "Makefile", ".env.example",
    ];

    const keyFiles: Record<string, string> = {};
    for (const name of keyFileNames) {
      if (tree.includes(name)) {
        try {
          const content = await this.github.getFileContent(name);
          keyFiles[name] = content.slice(0, 3000);
        } catch {}
      }
    }

    // Also grab a sample source file for style analysis
    const sourceFiles = tree.filter((f) =>
      /\.(ts|js|py|go|rs|java|rb)$/.test(f) &&
      !f.includes("node_modules") && !f.includes("dist") &&
      !f.includes("test") && !f.includes("spec"),
    );
    if (sourceFiles.length > 0) {
      const sampleFile = sourceFiles[Math.min(2, sourceFiles.length - 1)];
      try {
        const content = await this.github.getFileContent(sampleFile);
        keyFiles[`[sample] ${sampleFile}`] = content.slice(0, 2000);
      } catch {}
    }

    // Use LLM to analyze
    const analysis = await this.openai.chat([
      {
        role: "system",
        content: `You are analyzing a codebase to understand its technology stack, conventions, and architecture.

Respond in JSON:
{
  "language": "primary programming language",
  "framework": "main framework (e.g., Express, Next.js, Django, Gin, Actix)",
  "buildSystem": "build tool (e.g., npm, cargo, make, gradle)",
  "testFramework": "test framework (e.g., jest, pytest, go test)",
  "linter": "linter/formatter (e.g., eslint, prettier, black, golint)",
  "conventions": [
    "list of coding conventions observed",
    "e.g., 'Uses functional components'",
    "e.g., 'Uses barrel exports (index.ts)'"
  ],
  "architecture": "brief architecture description",
  "dependencies": ["key dependencies/libraries used"],
  "linterRules": [
    "Extract KEY linter/formatter rules from config files (.eslintrc*, .prettierrc*, etc.)",
    "Focus on rules that affect generated code: import order, unused vars, semicolons, quotes, etc.",
    "e.g., 'no-unused-vars: error'",
    "e.g., 'import/order: alphabetical groups [builtin, external, internal]'",
    "e.g., 'prettier: singleQuote=true, trailingComma=all, semi=true'",
    "e.g., '@typescript-eslint/no-explicit-any: warn'",
    "List up to 15 most impactful rules. If no config files found, return empty array."
  ]
}`,
      },
      {
        role: "user",
        content: `## Repository: ${repo.fullName}

## File Tree (sample)
${tree.slice(0, 100).join("\n")}
${tree.length > 100 ? `\n... and ${tree.length - 100} more files` : ""}

## Key Files
${Object.entries(keyFiles)
  .map(([name, content]) => `### ${name}\n\`\`\`\n${content}\n\`\`\``)
  .join("\n\n")}

Analyze this codebase.`,
      },
    ], true);

    const parsed = JSON.parse(analysis);

    return {
      repoFullName: repo.fullName,
      language: parsed.language,
      framework: parsed.framework,
      buildSystem: parsed.buildSystem,
      testFramework: parsed.testFramework,
      linter: parsed.linter,
      conventions: parsed.conventions,
      architecture: parsed.architecture,
      keyFiles: Object.fromEntries(Object.entries(keyFiles).map(([k]) => [k, "analyzed"])),
      dependencies: parsed.dependencies,
      linterRules: Array.isArray(parsed.linterRules) ? parsed.linterRules : [],
      lastUpdated: new Date(),
    };
  }
}
