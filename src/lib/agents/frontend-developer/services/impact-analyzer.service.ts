// ──────────────────────────────────────────────────────────
// Impact Analyzer — from ai-engineer-agent-v3
// Analyzes the impact of file changes BEFORE pushing
// ──────────────────────────────────────────────────────────

import { createChildLogger } from "../utils/logger";
import { GitHubService } from "./github.service";
import type { ImpactReport } from "../types";

const log = createChildLogger("impact-analyzer");

export class ImpactAnalyzerService {
  private github: GitHubService;

  constructor(github: GitHubService) {
    this.github = github;
  }

  async analyzeImpact(changedFiles: string[], repoTree: string[]): Promise<ImpactReport> {
    log.info({ changedFiles: changedFiles.length }, "Analyzing change impact");

    const directImpact = [...changedFiles];
    const downstreamImpact: Set<string> = new Set();
    const affectedTests: Set<string> = new Set();
    const warnings: string[] = [];

    for (const changedFile of changedFiles) {
      const baseName = changedFile.substring(changedFile.lastIndexOf("/") + 1, changedFile.lastIndexOf("."));
      const ext = changedFile.substring(changedFile.lastIndexOf("."));

      // Find downstream consumers
      const potentialConsumers = repoTree.filter(
        (f) => f !== changedFile && f.endsWith(ext) &&
          !f.includes("node_modules") && !f.includes("dist") && !f.includes(".git"),
      );

      for (const consumer of potentialConsumers) {
        try {
          const content = await this.github.getFileContent(consumer);
          if (content.includes(baseName)) {
            if (consumer.includes("test") || consumer.includes("spec")) {
              affectedTests.add(consumer);
            } else {
              downstreamImpact.add(consumer);
            }
          }
        } catch {}
      }

      // Find related test files
      const testPatterns = [
        changedFile.replace(ext, `.test${ext}`),
        changedFile.replace(ext, `.spec${ext}`),
        changedFile.replace(ext, `_test${ext}`),
        changedFile.replace(/\/([^/]+)$/, `/__tests__/$1`).replace(ext, `.test${ext}`),
      ];
      for (const testFile of testPatterns) {
        if (repoTree.includes(testFile)) affectedTests.add(testFile);
      }

      // Check for high-risk changes
      if (changedFile.includes("config") || changedFile.includes("env"))
        warnings.push(`Configuration file changed: ${changedFile}`);
      if (changedFile.includes("auth") || changedFile.includes("security"))
        warnings.push(`Security-related file changed: ${changedFile}`);
      if (changedFile.includes("migration") || changedFile.includes("schema"))
        warnings.push(`Database schema file changed: ${changedFile}`);
      if (changedFile === "package.json" || changedFile === "tsconfig.json")
        warnings.push(`Build configuration changed: ${changedFile}`);
    }

    // Calculate risk
    const totalAffected = downstreamImpact.size + affectedTests.size;
    let riskLevel: ImpactReport["riskLevel"] = "low";
    if (warnings.length >= 3 || totalAffected > 20) riskLevel = "critical";
    else if (warnings.length >= 2 || totalAffected > 10) riskLevel = "high";
    else if (warnings.length >= 1 || totalAffected > 5) riskLevel = "medium";

    const summary = [
      `Changing ${changedFiles.length} file(s) affects:`,
      `  ${downstreamImpact.size} downstream consumers`,
      `  ${affectedTests.size} test files should be re-run`,
      `  Risk level: ${riskLevel.toUpperCase()}`,
      warnings.length > 0 ? `  Warnings: ${warnings.length}` : "",
    ].filter(Boolean).join("\n");

    log.info({ downstream: downstreamImpact.size, tests: affectedTests.size, risk: riskLevel }, "Impact analysis complete");

    return {
      directImpact, downstreamImpact: [...downstreamImpact],
      affectedTests: [...affectedTests], riskLevel, summary, warnings,
    };
  }
}
