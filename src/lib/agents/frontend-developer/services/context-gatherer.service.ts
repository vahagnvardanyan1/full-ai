// ──────────────────────────────────────────────────────────
// Context Gatherer — from ai-engineer-agent-v3
// Gathers deep context before modifying any file
// ──────────────────────────────────────────────────────────

import { createChildLogger } from "../utils/logger";
import { GitHubService } from "./github.service";
import type { RepoKnowledge, FileContext } from "../types";

const log = createChildLogger("context-gatherer");

export class ContextGathererService {
  private github: GitHubService;

  constructor(github: GitHubService) {
    this.github = github;
  }

  async gatherContext(
    targetFile: string,
    repoTree: string[],
    repoKnowledge?: RepoKnowledge,
  ): Promise<FileContext> {
    log.info({ targetFile }, "Gathering deep context for file");

    const ctx: FileContext = {
      targetFile, importedBy: [], imports: [],
      relatedTests: [], siblingFiles: [], conventionsSummary: "",
    };

    // Read target file if it exists
    if (repoTree.includes(targetFile)) {
      try { ctx.existingCode = await this.github.getFileContent(targetFile); } catch {}
    }

    const dir = targetFile.substring(0, targetFile.lastIndexOf("/"));
    const ext = targetFile.substring(targetFile.lastIndexOf("."));
    const baseName = targetFile.substring(targetFile.lastIndexOf("/") + 1, targetFile.lastIndexOf("."));

    // 1. Find imports (what does this file use?)
    if (ctx.existingCode) {
      const importPaths = this.extractImportPaths(ctx.existingCode, ext);
      for (const importPath of importPaths.slice(0, 5)) {
        const resolved = this.resolveImportPath(importPath, dir, ext, repoTree);
        if (resolved) {
          try {
            const content = await this.github.getFileContent(resolved);
            ctx.imports.push({ filename: resolved, snippet: this.extractPublicAPI(content, ext).slice(0, 1500) });
          } catch {}
        }
      }
    }

    // 2. Find callers (who imports this file?)
    const possibleImportPatterns = [baseName, `./${baseName}`, `../${baseName}`];
    const potentialCallers = repoTree.filter(
      (f) => f !== targetFile && f.endsWith(ext) && !f.includes("node_modules") && !f.includes("dist"),
    );

    let callerCount = 0;
    for (const caller of potentialCallers) {
      if (callerCount >= 3) break;
      try {
        const content = await this.github.getFileContent(caller);
        if (possibleImportPatterns.some((p) => content.includes(p))) {
          ctx.importedBy.push({ filename: caller, snippet: this.extractRelevantLines(content, baseName).slice(0, 1000) });
          callerCount++;
        }
      } catch {}
    }

    // 3. Find related tests
    const testPatterns = [
      `${baseName}.test${ext}`, `${baseName}.spec${ext}`,
      `${baseName}_test${ext}`, `test_${baseName}${ext}`,
    ];
    for (const testFile of repoTree) {
      if (testPatterns.some((p) => testFile.endsWith(p))) {
        try {
          const content = await this.github.getFileContent(testFile);
          ctx.relatedTests.push({ filename: testFile, snippet: content.slice(0, 2000) });
        } catch {}
      }
    }

    // 4. Read sibling files for pattern matching
    const siblings = repoTree.filter(
      (f) => f !== targetFile && f.startsWith(dir + "/") && f.endsWith(ext) &&
        f.split("/").length === targetFile.split("/").length,
    );
    for (const sibling of siblings.slice(0, 2)) {
      try {
        const content = await this.github.getFileContent(sibling);
        ctx.siblingFiles.push({ filename: sibling, snippet: content.slice(0, 1500) });
      } catch {}
    }

    // 5. Build conventions summary
    ctx.conventionsSummary = this.buildConventionsSummary(ctx, repoKnowledge);

    log.info({
      targetFile, imports: ctx.imports.length, callers: ctx.importedBy.length,
      tests: ctx.relatedTests.length, siblings: ctx.siblingFiles.length,
    }, "Context gathered");

    return ctx;
  }

  formatForPrompt(ctx: FileContext): string {
    const parts: string[] = [];
    if (ctx.conventionsSummary) parts.push(`## Coding Conventions\n${ctx.conventionsSummary}`);
    if (ctx.imports.length > 0) {
      parts.push(`## Dependencies (files this module imports)\n${ctx.imports.map((i) => `### ${i.filename}\n\`\`\`\n${i.snippet}\n\`\`\``).join("\n")}`);
    }
    if (ctx.importedBy.length > 0) {
      parts.push(`## Callers (files that use this module)\n${ctx.importedBy.map((i) => `### ${i.filename}\n\`\`\`\n${i.snippet}\n\`\`\``).join("\n")}`);
    }
    if (ctx.relatedTests.length > 0) {
      parts.push(`## Existing Tests\n${ctx.relatedTests.map((t) => `### ${t.filename}\n\`\`\`\n${t.snippet}\n\`\`\``).join("\n")}`);
    }
    if (ctx.siblingFiles.length > 0) {
      parts.push(`## Similar Files (follow these patterns)\n${ctx.siblingFiles.map((s) => `### ${s.filename}\n\`\`\`\n${s.snippet}\n\`\`\``).join("\n")}`);
    }
    return parts.join("\n\n");
  }

  // ── Internal helpers ──

  private extractImportPaths(code: string, ext: string): string[] {
    const paths: string[] = [];
    if ([".ts", ".js", ".tsx", ".jsx"].includes(ext)) {
      const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
      let match;
      while ((match = importRegex.exec(code)) !== null) {
        if (match[1].startsWith(".")) paths.push(match[1]);
      }
      const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
      while ((match = requireRegex.exec(code)) !== null) {
        if (match[1].startsWith(".")) paths.push(match[1]);
      }
    }
    if (ext === ".py") {
      const fromRegex = /from\s+(\S+)\s+import/g;
      let match;
      while ((match = fromRegex.exec(code)) !== null) {
        if (match[1].startsWith(".")) paths.push(match[1]);
      }
    }
    return [...new Set(paths)];
  }

  private resolveImportPath(importPath: string, currentDir: string, ext: string, tree: string[]): string | null {
    const candidates = [
      `${currentDir}/${importPath}${ext}`, `${currentDir}/${importPath}/index${ext}`, `${currentDir}/${importPath}`,
    ];
    if (importPath.startsWith("../")) {
      const parentDir = currentDir.substring(0, currentDir.lastIndexOf("/"));
      const rest = importPath.slice(3);
      candidates.push(`${parentDir}/${rest}${ext}`, `${parentDir}/${rest}/index${ext}`, `${parentDir}/${rest}`);
    }
    for (const candidate of candidates) {
      const normalized = candidate.replace(/\/\.\//g, "/");
      if (tree.includes(normalized)) return normalized;
    }
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private extractPublicAPI(code: string, _ext: string): string {
    const lines = code.split("\n");
    const apiLines = lines.filter((line) => {
      const t = line.trim();
      return t.startsWith("export ") || t.startsWith("module.exports") ||
        t.startsWith("def ") || t.startsWith("class ") || t.startsWith("interface ") ||
        t.startsWith("type ") || t.startsWith("enum ");
    });
    return apiLines.length > 0 ? apiLines.join("\n") : code.slice(0, 1000);
  }

  private extractRelevantLines(code: string, keyword: string): string {
    const lines = code.split("\n");
    const relevant: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(keyword)) {
        const start = Math.max(0, i - 2);
        const end = Math.min(lines.length, i + 3);
        relevant.push(...lines.slice(start, end), "---");
      }
    }
    return relevant.join("\n");
  }

  private buildConventionsSummary(ctx: FileContext, knowledge?: RepoKnowledge): string {
    const parts: string[] = [];
    if (knowledge) {
      if (knowledge.conventions.length > 0) parts.push(`Observed conventions:\n${knowledge.conventions.map((c) => `- ${c}`).join("\n")}`);
      if (knowledge.architecture) parts.push(`Architecture: ${knowledge.architecture}`);
      if (knowledge.linter) parts.push(`Linter: ${knowledge.linter} — your code MUST pass this linter`);
      if (knowledge.testFramework) parts.push(`Test framework: ${knowledge.testFramework}`);
    }
    if (ctx.siblingFiles.length > 0) {
      parts.push(`Pattern: Follow the same structure/imports/naming as ${ctx.siblingFiles.map((s) => s.filename).join(", ")}`);
    }
    return parts.join("\n");
  }
}
