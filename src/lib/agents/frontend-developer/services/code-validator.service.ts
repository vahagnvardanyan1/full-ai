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

/** Parsed error from validation output — structured for LLM consumption */
export interface ParsedValidationError {
  file: string;
  line?: number;
  column?: number;
  rule?: string;
  message: string;
  severity: "error" | "warning";
}

export class CodeValidatorService {
  private timeout = 120_000;

  /**
   * Tier 1 — Deterministic auto-fix: detect project tools and run their
   * fix commands BEFORE validation. Fixes 80%+ of formatting/lint issues
   * without LLM involvement.
   *
   * The agent DISCOVERS what tools the project uses by reading package.json
   * scripts and checking for config files — it does NOT hardcode any specific
   * framework commands. This makes it work with any project regardless of
   * tech stack.
   *
   * Strategy:
   *   1. Discover available fix scripts from package.json (format, lint:fix, etc.)
   *   2. Detect formatting tools from config files (prettier, etc.)
   *   3. Detect linting tools from config files (eslint, etc.)
   *   4. Run whichever applies: project scripts first (they know their own config),
   *      then direct tool invocations as fallback.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async autoFix(repoDir: string, _repoKnowledge?: RepoKnowledge): Promise<string[]> {
    const fixes: string[] = [];
    const execOpts = {
      cwd: repoDir, timeout: this.timeout,
      maxBuffer: 10 * 1024 * 1024, encoding: "utf-8" as const,
      env: { ...process.env, CI: "true" },
    };

    // ── Discover project scripts from package.json ──
    const scripts = await this.getNpmScripts(repoDir);
    log.info(`Discovered npm scripts: ${Object.keys(scripts).join(", ") || "none"}`);

    // ── 1. Auto-fix formatting ──
    // Priority: project script > direct tool invocation
    const formatFixApplied = await this.tryFixCommands(repoDir, execOpts, [
      // Project-defined format scripts (knows its own config)
      scripts["format:fix"] ? { cmd: "npm run format:fix 2>&1 || true", label: "npm run format:fix" } : null,
      scripts["format"] && this.scriptLooksLikeFix(scripts["format"]) ? { cmd: "npm run format 2>&1 || true", label: "npm run format" } : null,
      scripts["prettier:fix"] ? { cmd: "npm run prettier:fix 2>&1 || true", label: "npm run prettier:fix" } : null,
      // Direct Prettier invocation as fallback
      await this.hasPrettierConfig(repoDir) ? { cmd: "npx prettier --write . 2>&1 || true", label: "prettier --write" } : null,
    ].filter(Boolean) as { cmd: string; label: string }[]);

    if (formatFixApplied) fixes.push(formatFixApplied);

    // ── 2. Auto-fix linting ──
    // Priority: project lint:fix script > project lint --fix > direct eslint --fix
    const lintFixApplied = await this.tryFixCommands(repoDir, execOpts, [
      // Project-defined lint fix scripts
      scripts["lint:fix"] ? { cmd: "npm run lint:fix 2>&1 || true", label: "npm run lint:fix" } : null,
      scripts["eslint:fix"] ? { cmd: "npm run eslint:fix 2>&1 || true", label: "npm run eslint:fix" } : null,
      // Try passing --fix to the project's lint command
      scripts["lint"] ? { cmd: "npm run lint -- --fix 2>&1 || true", label: "npm run lint -- --fix" } : null,
      // Direct ESLint invocation as last resort
      await this.hasEslintConfig(repoDir) ? { cmd: "npx eslint . --fix --max-warnings=50 2>&1 || true", label: "eslint --fix" } : null,
    ].filter(Boolean) as { cmd: string; label: string }[]);

    if (lintFixApplied) fixes.push(lintFixApplied);

    return fixes;
  }

  /**
   * Try a list of fix commands in order. Return the label of the first one
   * that succeeds without throwing. This lets the agent discover which
   * command works for this specific project.
   */
  private async tryFixCommands(
    repoDir: string,
    execOpts: { cwd: string; timeout: number; maxBuffer: number; encoding: "utf-8"; env: NodeJS.ProcessEnv },
    commands: { cmd: string; label: string }[],
  ): Promise<string | null> {
    for (const { cmd, label } of commands) {
      try {
        execSync(cmd, { ...execOpts, timeout: 180_000 });
        log.info(`Auto-fix applied: ${label}`);
        return label;
      } catch (err) {
        log.warn(`Auto-fix: ${label} failed: ${String(err).slice(0, 200)}`);
        // Continue to next command
      }
    }
    return null;
  }

  /**
   * Check if a script value looks like it runs a formatter in write mode
   * (e.g., "prettier --write ." or "prettier -w src/")
   */
  private scriptLooksLikeFix(scriptValue: string): boolean {
    return /--write\b|--fix\b|-w\b/.test(scriptValue);
  }

  private async hasPrettierConfig(dir: string): Promise<boolean> {
    return (
      (await this.fileExists(dir, ".prettierrc")) ||
      (await this.fileExists(dir, ".prettierrc.json")) ||
      (await this.fileExists(dir, ".prettierrc.js")) ||
      (await this.fileExists(dir, "prettier.config.js")) ||
      (await this.fileExists(dir, "prettier.config.mjs"))
    );
  }

  /**
   * Read all npm scripts from package.json.
   * Returns empty object if package.json doesn't exist.
   */
  private async getNpmScripts(dir: string): Promise<Record<string, string>> {
    try {
      const pkg = JSON.parse(await fs.readFile(path.join(dir, "package.json"), "utf-8"));
      return pkg.scripts || {};
    } catch {
      return {};
    }
  }

  /**
   * Parse raw validation output into structured errors.
   * Works with ESLint, TypeScript (tsc), and Prettier output formats.
   * Returns per-file, per-line errors the LLM can understand.
   */
  parseErrors(step: ValidationStep): ParsedValidationError[] {
    const errors: ParsedValidationError[] = [];
    if (!step.output) return errors;

    if (step.name === "type-check") {
      // tsc output format: src/foo.ts(10,5): error TS2322: ...
      const tscRegex = /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/gm;
      let m;
      while ((m = tscRegex.exec(step.output)) !== null) {
        errors.push({
          file: m[1].trim(),
          line: parseInt(m[2]),
          column: parseInt(m[3]),
          rule: m[5],
          message: m[6].trim(),
          severity: m[4] === "error" ? "error" : "warning",
        });
      }
    } else if (step.name === "lint") {
      // ESLint output format: /path/src/foo.ts
      //   10:5  error  Some message  rule-name
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _eslintLineRegex = /^\s*(\d+):(\d+)\s+(error|warning)\s+(.+?)\s{2,}(\S+)\s*$/gm;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _eslintFileRegex = /^(\/[^\s]+?\.\w+)$/gm;
      let currentFile = "";

      // Parse file headers first
      const lines = step.output.split("\n");
      for (const line of lines) {
        const fileMatch = line.match(/^(\/[^\s]+?\.\w+)$/);
        if (fileMatch) {
          currentFile = fileMatch[1];
          continue;
        }
        const errMatch = line.match(/^\s*(\d+):(\d+)\s+(error|warning)\s+(.+?)\s{2,}(\S+)\s*$/);
        if (errMatch && currentFile) {
          errors.push({
            file: currentFile,
            line: parseInt(errMatch[1]),
            column: parseInt(errMatch[2]),
            rule: errMatch[5],
            message: errMatch[4].trim(),
            severity: errMatch[3] === "error" ? "error" : "warning",
          });
        }
      }
    } else if (step.name === "build") {
      // Generic build error parsing — works with any bundler/framework.
      // Build tools (Webpack, Vite, Turbopack, Rollup, esbuild, Parcel, etc.)
      // share common patterns for reporting errors.

      let m;

      // Pattern 1: file:line:col followed by error message (universal)
      // Matches: ./src/app/page.tsx:7:1  or  src/foo.ts:10:5
      const fileLineColRegex = /^\.?\/?((src|app|lib|pages|components|modules|packages)[^\s:]+):(\d+):(\d+)\b/gm;
      while ((m = fileLineColRegex.exec(step.output)) !== null) {
        // Grab the rest of the line and next line as potential error message
        const afterMatch = step.output.slice(m.index + m[0].length, step.output.indexOf("\n", m.index + m[0].length + 1));
        const nextLineIdx = step.output.indexOf("\n", m.index);
        const nextLine = nextLineIdx >= 0 ? step.output.slice(nextLineIdx + 1, step.output.indexOf("\n", nextLineIdx + 1)).trim() : "";
        const message = afterMatch.trim() || nextLine || "Build error at this location";
        errors.push({
          file: m[1].trim(),
          line: parseInt(m[3]),
          column: parseInt(m[4]),
          message: message.slice(0, 300),
          severity: "error",
        });
      }

      // Pattern 2: "Export X doesn't exist" / "export X not found" (bundler module resolution)
      const exportMissingRegex = /(?:Export|export)\s+['"]?(\w+)['"]?\s+(?:doesn't exist|not found|is not exported)/gi;
      while ((m = exportMissingRegex.exec(step.output)) !== null) {
        // Try to find which file is referenced nearby
        const context = step.output.slice(Math.max(0, m.index - 500), m.index + m[0].length + 200);
        const fileRef = context.match(/\.?\/?((src|app|lib|pages|components|modules|packages)[^\s:]+?\.\w+)/);
        errors.push({
          file: fileRef ? fileRef[1] : "unknown",
          message: `Export "${m[1]}" not found. Check if it's a default export (use "import X" instead of "import { X }") or verify the export name matches the source file.`,
          severity: "error",
        });
      }

      // Pattern 3: "was not found in module" (bundler-agnostic)
      const notFoundRegex = /(?:The\s+)?export\s+['"]?(\w+)['"]?\s+was not found in (?:module\s+)?(?:\[[\w]+\]\/)?([\w/.[\]-]+)/gi;
      while ((m = notFoundRegex.exec(step.output)) !== null) {
        if (!errors.some((e) => e.file === m![2] && e.message.includes(m![1]))) {
          errors.push({
            file: m[2],
            message: `Export "${m[1]}" was not found in module "${m[2]}". Check if it's a default export or verify the export name.`,
            severity: "error",
          });
        }
      }

      // Pattern 4: "Module not found" / "Cannot find module" (universal)
      const moduleNotFoundRegex = /(?:Module not found|Cannot find module|Cannot resolve)[:\s]+['"]?([^'";\n]+)['"]?/gi;
      while ((m = moduleNotFoundRegex.exec(step.output)) !== null) {
        const context = step.output.slice(Math.max(0, m.index - 500), m.index + m[0].length + 200);
        const fileRef = context.match(/\.?\/?((src|app|lib|pages|components|modules|packages)[^\s:]+?\.\w+)/);
        errors.push({
          file: fileRef ? fileRef[1] : "unknown",
          message: `Module not found: "${m[1].trim().slice(0, 200)}". Check that the import path is correct and the module exists.`,
          severity: "error",
        });
      }

      // Pattern 5: "SyntaxError" / "Unexpected token" (universal parse errors)
      const syntaxRegex = /(?:SyntaxError|Unexpected token)[:\s]+(.{1,200})/gi;
      while ((m = syntaxRegex.exec(step.output)) !== null) {
        const context = step.output.slice(Math.max(0, m.index - 500), m.index);
        const fileRef = context.match(/\.?\/?((src|app|lib|pages|components|modules|packages)[^\s:]+?\.\w+)/);
        errors.push({
          file: fileRef ? fileRef[1] : "unknown",
          message: `Syntax error: ${m[1].trim()}`,
          severity: "error",
        });
      }

      // If no structured errors were parsed, create a single generic error from the build output
      // so the LLM still gets the full context to work with
      if (errors.length === 0 && step.output.length > 0) {
        errors.push({
          file: "unknown",
          message: `Build failed. Raw output (analyze and fix):\n${step.output.slice(0, 3000)}`,
          severity: "error",
        });
      }
    } else if (step.name === "format-check") {
      // Prettier output: Checking formatting...
      // [warn] src/foo.ts
      const prettierRegex = /\[warn\]\s+(.+)/g;
      let m;
      while ((m = prettierRegex.exec(step.output)) !== null) {
        errors.push({
          file: m[1].trim(),
          message: "File is not formatted according to Prettier rules",
          severity: "warning",
        });
      }
    }

    return errors;
  }

  /**
   * Format parsed errors into a structured per-file summary for the LLM.
   * Much cleaner than dumping raw tool output.
   */
  formatErrorsForLLM(errors: ParsedValidationError[], targetFile?: string): string {
    const filtered = targetFile
      ? errors.filter((e) => e.file.includes(targetFile) || targetFile.includes(e.file.replace(/^.*\//, "")))
      : errors;

    if (filtered.length === 0) return "";

    // Group by file
    const byFile = new Map<string, ParsedValidationError[]>();
    for (const err of filtered) {
      const existing = byFile.get(err.file) || [];
      existing.push(err);
      byFile.set(err.file, existing);
    }

    const parts: string[] = [];
    for (const [file, fileErrors] of byFile) {
      parts.push(`### ${file}`);
      for (const err of fileErrors) {
        const loc = err.line ? `Line ${err.line}${err.column ? `:${err.column}` : ""}` : "File-level";
        const rule = err.rule ? ` [${err.rule}]` : "";
        parts.push(`  - ${loc}: ${err.severity.toUpperCase()}${rule} — ${err.message}`);
      }
    }

    return parts.join("\n");
  }

  async validate(repoDir: string, repoKnowledge?: RepoKnowledge, opts?: { skipInstall?: boolean; skipBuild?: boolean }): Promise<ValidationResult> {
    log.info({ repoDir, opts }, "Starting code validation pipeline");
    const steps: ValidationStep[] = [];

    // Step 1: Install dependencies (skip if already installed during clone)
    if (!opts?.skipInstall) {
      if (await this.fileExists(repoDir, "package.json")) {
        steps.push(await this.runStep(repoDir, "install-deps", "npm install --prefer-offline --no-audit", 180_000));
      } else if (await this.fileExists(repoDir, "requirements.txt")) {
        steps.push(await this.runStep(repoDir, "install-deps", "pip install -r requirements.txt -q", 180_000));
      }
    }

    // Steps 2-4: Run tsc, lint, and format check in parallel
    const [tscResult, lintResult, formatResult] = await Promise.all([
      // Type checking
      (await this.fileExists(repoDir, "tsconfig.json"))
        ? this.runStep(repoDir, "type-check", "npx tsc --noEmit --pretty 2>&1 || true")
        : null,
      // Linting
      this.detectAndRunLinter(repoDir, repoKnowledge),
      // Formatting check
      this.detectAndRunFormatter(repoDir),
    ]);
    if (tscResult) steps.push(tscResult);
    if (lintResult) steps.push(lintResult);
    if (formatResult) steps.push(formatResult);

    // Step 5: Build (skip if opts.skipBuild — tsc+lint sufficient, QA handles build)
    if (!opts?.skipBuild) {
      const buildStep = await this.detectAndRunBuild(repoDir);
      if (buildStep) steps.push(buildStep);
    }

    // Step 6: Run tests
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
    // Priority: project's own lint script (knows its own config) > direct tool invocation
    // The project's "lint" script could be `next lint`, `eslint .`, `biome check`, etc.
    // We don't hardcode — we let the project define how to lint.
    if (await this.hasNpmScript(repoDir, "lint")) {
      return this.runStep(repoDir, "lint", "npm run lint 2>&1 || true", 180_000);
    }
    if (await this.hasEslintConfig(repoDir)) {
      return this.runStep(repoDir, "lint", "npx eslint . --max-warnings=50 2>&1 || true");
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

  /**
   * Discover and run the project's build command.
   * A mid-level engineer always runs the build before opening a PR —
   * the build catches bundler/framework-level errors that type-checking alone misses:
   *   - Module resolution (named vs default exports, missing modules)
   *   - CSS/PostCSS/Tailwind compilation errors
   *   - Framework plugin validations
   *   - Asset pipeline issues
   *
   * Discovery-based: checks multiple common script names, runs whichever exists.
   */
  private async detectAndRunBuild(repoDir: string): Promise<ValidationStep | null> {
    // Try common build script names in priority order
    const buildScriptNames = ["build", "compile", "dist", "bundle"];
    for (const name of buildScriptNames) {
      if (await this.hasNpmScript(repoDir, name)) {
        return this.runStep(repoDir, "build", `npm run ${name} 2>&1`, 300_000);
      }
    }
    // Check for Makefile with build target
    if (await this.fileExists(repoDir, "Makefile")) {
      try {
        const makefile = await fs.readFile(path.join(repoDir, "Makefile"), "utf-8");
        if (/^build:/m.test(makefile)) {
          return this.runStep(repoDir, "build", "make build 2>&1", 300_000);
        }
      } catch { /* ignore */ }
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
    if (stepName === "build") {
      // A build succeeded if it has clear success markers and no failure markers
      const successMarkers = /compiled successfully|build completed|built in|done in|✓ compiled|output:/i;
      const failureMarkers = /error occurred|ELIFECYCLE|exited with|Build failed|ERROR in|fatal error|Cannot find module|Module not found|SyntaxError/i;
      if (failureMarkers.test(output)) return true;
      if (successMarkers.test(output)) return false;
      // If no clear markers, assume failure if exit was non-zero (caught by runStep try/catch)
      return false;
    }
    if (stepName === "test") return /FAIL|failed|error/i.test(output) && !/0 failed/i.test(output);
    return false;
  }

  private async hasEslintConfig(dir: string): Promise<boolean> {
    return (
      (await this.fileExists(dir, ".eslintrc.json")) ||
      (await this.fileExists(dir, ".eslintrc.js")) ||
      (await this.fileExists(dir, ".eslintrc.yml")) ||
      (await this.fileExists(dir, "eslint.config.js")) ||
      (await this.fileExists(dir, "eslint.config.mjs"))
    );
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
