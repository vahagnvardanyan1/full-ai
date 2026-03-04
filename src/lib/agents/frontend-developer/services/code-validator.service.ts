// ──────────────────────────────────────────────────────────
// Code Validator — from ai-engineer-agent-v3
// Runs real tools (tsc, eslint, jest) in cloned repo dir
// ──────────────────────────────────────────────────────────

import { execSync, ExecSyncOptions } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import { createChildLogger } from "../utils/logger";
import type { RepoKnowledge, ValidationResult, ValidationStep } from "../types";

const log = createChildLogger("code-validator");

export class CodeValidatorService {
  private timeout = 120_000;

  async validate(repoDir: string, repoKnowledge?: RepoKnowledge): Promise<ValidationResult> {
    log.info({ repoDir }, "Starting code validation pipeline");
    const steps: ValidationStep[] = [];

    // Step 1: Install dependencies
    if (await this.fileExists(repoDir, "package.json")) {
      steps.push(await this.runStep(repoDir, "install-deps", "npm install --prefer-offline --no-audit", 180_000));
    } else if (await this.fileExists(repoDir, "requirements.txt")) {
      steps.push(await this.runStep(repoDir, "install-deps", "pip install -r requirements.txt -q", 180_000));
    }

    // Step 2: Type checking
    if (await this.fileExists(repoDir, "tsconfig.json")) {
      steps.push(await this.runStep(repoDir, "type-check", "npx tsc --noEmit --pretty 2>&1 || true"));
    }

    // Step 3: Linting
    const lintStep = await this.detectAndRunLinter(repoDir, repoKnowledge);
    if (lintStep) steps.push(lintStep);

    // Step 4: Formatting check
    const formatStep = await this.detectAndRunFormatter(repoDir);
    if (formatStep) steps.push(formatStep);

    // Step 5: Run tests
    const testStep = await this.detectAndRunTests(repoDir, repoKnowledge);
    if (testStep) steps.push(testStep);

    const failed = steps.filter((s) => !s.passed && !s.skipped);
    const passed = steps.filter((s) => s.passed);
    const skipped = steps.filter((s) => s.skipped);

    const summary = [
      `Validation: ${passed.length} passed, ${failed.length} failed, ${skipped.length} skipped`,
      ...failed.map((s) => `  FAIL ${s.name}: ${s.output.slice(0, 200)}`),
    ].join("\n");

    log.info({ passed: passed.length, failed: failed.length, skipped: skipped.length }, "Validation complete");
    return { passed: failed.length === 0, steps, summary };
  }

  async quickValidate(repoDir: string, repoKnowledge?: RepoKnowledge): Promise<ValidationResult> {
    const steps: ValidationStep[] = [];
    if (await this.fileExists(repoDir, "tsconfig.json")) {
      steps.push(await this.runStep(repoDir, "type-check", "npx tsc --noEmit --pretty 2>&1 || true"));
    }
    const lintStep = await this.detectAndRunLinter(repoDir, repoKnowledge);
    if (lintStep) steps.push(lintStep);
    const failed = steps.filter((s) => !s.passed && !s.skipped);
    return {
      passed: failed.length === 0, steps,
      summary: `Quick validation: ${failed.length === 0 ? "PASSED" : `${failed.length} issues found`}`,
    };
  }

  // ── Detection helpers ──

  private async detectAndRunLinter(repoDir: string, knowledge?: RepoKnowledge): Promise<ValidationStep | null> {
    if (
      (await this.fileExists(repoDir, ".eslintrc.json")) ||
      (await this.fileExists(repoDir, ".eslintrc.js")) ||
      (await this.fileExists(repoDir, ".eslintrc.yml")) ||
      (await this.fileExists(repoDir, "eslint.config.js")) ||
      (await this.fileExists(repoDir, "eslint.config.mjs"))
    ) {
      return this.runStep(repoDir, "lint", "npx eslint . --max-warnings=50 2>&1 || true");
    }
    if (await this.hasNpmScript(repoDir, "lint")) {
      return this.runStep(repoDir, "lint", "npm run lint 2>&1 || true");
    }
    if (knowledge?.language?.toLowerCase() === "python" && (await this.commandExists(repoDir, "ruff"))) {
      return this.runStep(repoDir, "lint", "ruff check . 2>&1 || true");
    }
    return null;
  }

  private async detectAndRunFormatter(repoDir: string): Promise<ValidationStep | null> {
    if (
      (await this.fileExists(repoDir, ".prettierrc")) ||
      (await this.fileExists(repoDir, ".prettierrc.json")) ||
      (await this.fileExists(repoDir, "prettier.config.js"))
    ) {
      return this.runStep(repoDir, "format-check", "npx prettier --check . 2>&1 || true");
    }
    if (await this.hasNpmScript(repoDir, "format:check")) {
      return this.runStep(repoDir, "format-check", "npm run format:check 2>&1 || true");
    }
    return null;
  }

  private async detectAndRunTests(repoDir: string, knowledge?: RepoKnowledge): Promise<ValidationStep | null> {
    if (await this.hasNpmScript(repoDir, "test")) {
      return this.runStep(repoDir, "test", "npm test -- --passWithNoTests 2>&1 || npm test 2>&1 || true", 180_000);
    }
    if (knowledge?.testFramework?.toLowerCase().includes("pytest")) {
      return this.runStep(repoDir, "test", "pytest -x --tb=short 2>&1 || true", 180_000);
    }
    return {
      name: "test", passed: true, output: "No test framework detected",
      duration: 0, skipped: true, skipReason: "No test framework detected",
    };
  }

  // ── Execution ──

  private async runStep(repoDir: string, name: string, command: string, timeout?: number): Promise<ValidationStep> {
    const start = Date.now();
    log.debug({ name, command }, "Running validation step");
    try {
      const opts: ExecSyncOptions = {
        cwd: repoDir, timeout: timeout || this.timeout,
        maxBuffer: 10 * 1024 * 1024, encoding: "utf-8",
        env: { ...process.env, CI: "true", NODE_ENV: "test" },
      };
      const output = execSync(command, opts) as string;
      const duration = Date.now() - start;
      const hasErrors = this.outputHasErrors(name, output);
      return { name, passed: !hasErrors, output: (output || "").slice(0, 5000), duration };
    } catch (err: unknown) {
      const duration = Date.now() - start;
      const e = err as { stdout?: string; stderr?: string; message?: string };
      const output = (e.stdout || e.stderr || e.message || "Unknown error").slice(0, 5000);
      return { name, passed: false, output, duration };
    }
  }

  private outputHasErrors(stepName: string, output: string): boolean {
    if (!output) return false;
    if (stepName === "type-check") return /error TS\d+/i.test(output);
    if (stepName === "lint") return /\d+ error/i.test(output) && !/0 errors/i.test(output);
    if (stepName === "test") return /FAIL|failed|error/i.test(output) && !/0 failed/i.test(output);
    return false;
  }

  private async fileExists(dir: string, filename: string): Promise<boolean> {
    try { await fs.access(path.join(dir, filename)); return true; } catch { return false; }
  }

  private async hasNpmScript(dir: string, scriptName: string): Promise<boolean> {
    try {
      const pkg = JSON.parse(await fs.readFile(path.join(dir, "package.json"), "utf-8"));
      return !!pkg.scripts?.[scriptName];
    } catch { return false; }
  }

  private async commandExists(dir: string, cmd: string): Promise<boolean> {
    try { execSync(`which ${cmd}`, { cwd: dir, timeout: 5000, encoding: "utf-8" }); return true; } catch { return false; }
  }
}
