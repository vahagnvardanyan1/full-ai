// ──────────────────────────────────────────────────────────
// PM Context Service — gathers repository context for
// requirements analysis and task planning.
//
// Reuses the FE agent's GitHubService for repo access
// rather than duplicating Octokit wrappers.
// ──────────────────────────────────────────────────────────

import { GitHubService } from "../../frontend-developer/services/github.service";
import { createChildLogger } from "../utils/logger";
import type { PMRepoContext } from "../types";

const log = createChildLogger("context");

export class PMContextService {
  private github: GitHubService;

  constructor() {
    this.github = new GitHubService();
  }

  /**
   * Gather full repo context for PM planning.
   * Returns structured info about the repo including pages,
   * components, tech stack, and dependencies.
   */
  async gatherContext(): Promise<PMRepoContext> {
    log.info("Gathering repository context for PM planning");

    const repoInfo = await this.github.getRepoInfo();
    const fileTree = await this.github.getRepoTree(repoInfo.defaultBranch);

    // Extract structured info from file tree
    const existingPages = this.findByPattern(fileTree, [
      /\/page\.(tsx?|jsx?)$/,      // Next.js App Router pages
      /\/pages\/.*\.(tsx?|jsx?)$/,  // Next.js Pages Router
      /\/routes\/.*\.(tsx?|jsx?)$/, // Remix / React Router
    ]);

    const existingComponents = this.findByPattern(fileTree, [
      /\/components\/.*\.(tsx?|jsx?)$/,
      /\/ui\/.*\.(tsx?|jsx?)$/,
    ]);

    const configFiles = fileTree.filter((f) =>
      /^(package\.json|tsconfig\.json|next\.config\.|tailwind\.config\.|\.eslintrc|eslint\.config|vite\.config)/.test(f)
    );

    // Read package.json for deps
    let packageDeps: string[] = [];
    try {
      const pkgContent = await this.github.getFileContent("package.json");
      const pkg = JSON.parse(pkgContent);
      packageDeps = [
        ...Object.keys(pkg.dependencies || {}),
        ...Object.keys(pkg.devDependencies || {}),
      ];
    } catch {
      log.warn("Could not read package.json");
    }

    // Determine tech stack from files and deps
    const techStack = this.detectTechStack(fileTree, packageDeps);

    const context: PMRepoContext = {
      repoFullName: repoInfo.fullName,
      defaultBranch: repoInfo.defaultBranch,
      fileTree,
      techStack,
      existingPages,
      existingComponents,
      configFiles,
      packageDeps,
    };

    log.info(`Context gathered: ${fileTree.length} files, ${existingPages.length} pages, ${existingComponents.length} components`);
    return context;
  }

  /**
   * Build a formatted context string for LLM prompts.
   */
  formatForPrompt(ctx: PMRepoContext): string {
    // Show top-level + important directories (depth ≤ 5)
    const importantDirs = ["src/", "app/", "pages/", "components/", "lib/", "hooks/", "utils/", "styles/", "public/"];
    const topLevel = ctx.fileTree.filter((f) => !f.includes("/") || f.split("/").length <= 2);
    const deep = ctx.fileTree.filter((f) => {
      const depth = f.split("/").length;
      return depth > 2 && depth <= 5 && importantDirs.some((d) => f.startsWith(d));
    });
    const treeEntries = [...new Set([...topLevel, ...deep])].sort().slice(0, 200);

    const parts: string[] = [
      `## Repository: ${ctx.repoFullName}`,
      `Default branch: ${ctx.defaultBranch}`,
      `Tech stack: ${ctx.techStack}`,
      `Total files: ${ctx.fileTree.length}`,
    ];

    if (ctx.existingPages.length > 0) {
      parts.push(`\n### Existing Pages (${ctx.existingPages.length}):`);
      parts.push(ctx.existingPages.slice(0, 30).map((p) => `  - ${p}`).join("\n"));
    }

    if (ctx.existingComponents.length > 0) {
      parts.push(`\n### Existing Components (${ctx.existingComponents.length}):`);
      parts.push(ctx.existingComponents.slice(0, 40).map((c) => `  - ${c}`).join("\n"));
    }

    parts.push(`\n### File Tree:`);
    parts.push(treeEntries.join("\n"));

    if (ctx.packageDeps.length > 0) {
      parts.push(`\n### Key Dependencies:`);
      parts.push(ctx.packageDeps.slice(0, 30).join(", "));
    }

    return parts.join("\n");
  }

  /**
   * Find files related to a task by keyword search.
   */
  async findRelatedFiles(keywords: string[], fileTree: string[]): Promise<string[]> {
    return this.github.findRelatedFiles(fileTree, keywords);
  }

  /**
   * Read specific files for deeper context.
   */
  async readFiles(paths: string[]): Promise<Map<string, string>> {
    return this.github.readMultipleFiles(paths, 2000);
  }

  // ── Private Helpers ──

  private findByPattern(files: string[], patterns: RegExp[]): string[] {
    return files.filter((f) => patterns.some((p) => p.test(f)));
  }

  private detectTechStack(files: string[], deps: string[]): string {
    const parts: string[] = [];

    // Language
    if (files.some((f) => f.endsWith(".ts") || f.endsWith(".tsx"))) parts.push("TypeScript");
    else if (files.some((f) => f.endsWith(".js") || f.endsWith(".jsx"))) parts.push("JavaScript");

    // Framework
    if (deps.includes("next")) parts.push("Next.js");
    else if (deps.includes("react")) parts.push("React");
    else if (deps.includes("vue")) parts.push("Vue.js");
    else if (deps.includes("svelte")) parts.push("Svelte");
    else if (deps.includes("angular")) parts.push("Angular");

    // Router
    if (files.some((f) => f.startsWith("app/") && f.endsWith("page.tsx"))) parts.push("App Router");
    else if (files.some((f) => f.startsWith("pages/"))) parts.push("Pages Router");

    // Styling
    if (deps.includes("tailwindcss")) parts.push("Tailwind CSS");
    else if (deps.includes("styled-components")) parts.push("styled-components");
    else if (files.some((f) => f.endsWith(".module.css"))) parts.push("CSS Modules");

    // State
    if (deps.includes("zustand")) parts.push("Zustand");
    else if (deps.includes("redux") || deps.includes("@reduxjs/toolkit")) parts.push("Redux");

    // Testing
    if (deps.includes("vitest")) parts.push("Vitest");
    else if (deps.includes("jest")) parts.push("Jest");

    return parts.join(" + ") || "Unknown";
  }
}
