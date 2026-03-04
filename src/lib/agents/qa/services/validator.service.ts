import { execSync } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";

import type { QAValidationResult, QAValidationStep } from "../types";

const MAX_OUTPUT_CHARS = 3500;
const COMMAND_TIMEOUT_MS = 180_000;

interface PackageJsonShape {
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
}

export class QAValidatorService {
  run = async ({
    projectDir,
  }: {
    projectDir: string;
  }): Promise<QAValidationResult> => {
    const packageJson = await this.readPackageJson({ projectDir });
    const scripts = packageJson?.scripts || {};

    const steps: QAValidationStep[] = [];

    steps.push(
      await this.runTypeCheckStep({ projectDir, scripts, packageJson }),
    );
    steps.push(await this.runTestStep({ projectDir, scripts }));
    steps.push(await this.runBuildStep({ projectDir, scripts }));
    steps.push(await this.runLintStep({ projectDir, scripts }));

    const failedSteps = steps.filter((step) => !step.passed && !step.skipped);
    const passed = failedSteps.length === 0;
    const summary = passed
      ? "Validation checks passed for available QA gates."
      : `Validation failed in: ${failedSteps.map((step) => step.name).join(", ")}`;

    return {
      passed,
      summary,
      steps,
    };
  };

  private readPackageJson = async ({
    projectDir,
  }: {
    projectDir: string;
  }): Promise<PackageJsonShape | null> => {
    try {
      const raw = await fs.readFile(path.join(projectDir, "package.json"), "utf-8");
      return JSON.parse(raw) as PackageJsonShape;
    } catch {
      return null;
    }
  };

  private runTypeCheckStep = async ({
    projectDir,
    scripts,
    packageJson,
  }: {
    projectDir: string;
    scripts: Record<string, string>;
    packageJson: PackageJsonShape | null;
  }): Promise<QAValidationStep> => {
    if (scripts["type-check"]) {
      return this.executeStep({
        name: "type-check",
        command: "npm run type-check",
        projectDir,
      });
    }

    const hasTypeScript =
      Boolean(packageJson?.devDependencies?.typescript) ||
      Boolean(packageJson?.dependencies?.typescript) ||
      (await this.fileExists({ projectDir, relativePath: "tsconfig.json" }));

    if (!hasTypeScript) {
      return {
        name: "type-check",
        command: "npx tsc --noEmit",
        passed: true,
        output: "Skipped: TypeScript not detected.",
        skipped: true,
        skipReason: "typescript_not_detected",
      };
    }

    return this.executeStep({
      name: "type-check",
      command: "npx tsc --noEmit",
      projectDir,
    });
  };

  private runTestStep = async ({
    projectDir,
    scripts,
  }: {
    projectDir: string;
    scripts: Record<string, string>;
  }): Promise<QAValidationStep> => {
    if (scripts["test:ci"]) {
      return this.executeStep({
        name: "test",
        command: "npm run test:ci",
        projectDir,
      });
    }

    const testScript = scripts.test;
    if (!testScript) {
      return {
        name: "test",
        command: "npm run test",
        passed: true,
        output: "Skipped: no test script available.",
        skipped: true,
        skipReason: "missing_test_script",
      };
    }

    if (/watch/.test(testScript)) {
      return {
        name: "test",
        command: "npm run test",
        passed: true,
        output: "Skipped: test script appears interactive/watch-based.",
        skipped: true,
        skipReason: "interactive_test_script",
      };
    }

    return this.executeStep({
      name: "test",
      command: "npm run test",
      projectDir,
    });
  };

  private runBuildStep = async ({
    projectDir,
    scripts,
  }: {
    projectDir: string;
    scripts: Record<string, string>;
  }): Promise<QAValidationStep> => {
    if (!scripts.build) {
      return {
        name: "build",
        command: "npm run build",
        passed: true,
        output: "Skipped: no build script available.",
        skipped: true,
        skipReason: "missing_build_script",
      };
    }

    return this.executeStep({
      name: "build",
      command: "npm run build",
      projectDir,
    });
  };

  private runLintStep = async ({
    projectDir,
    scripts,
  }: {
    projectDir: string;
    scripts: Record<string, string>;
  }): Promise<QAValidationStep> => {
    if (!scripts.lint) {
      return {
        name: "lint",
        command: "npm run lint",
        passed: true,
        output: "Skipped: no lint script available.",
        skipped: true,
        skipReason: "missing_lint_script",
      };
    }

    const hasEslintConfig =
      (await this.fileExists({ projectDir, relativePath: ".eslintrc" })) ||
      (await this.fileExists({ projectDir, relativePath: ".eslintrc.js" })) ||
      (await this.fileExists({ projectDir, relativePath: ".eslintrc.cjs" })) ||
      (await this.fileExists({ projectDir, relativePath: ".eslintrc.json" })) ||
      (await this.fileExists({ projectDir, relativePath: "eslint.config.js" })) ||
      (await this.fileExists({ projectDir, relativePath: "eslint.config.mjs" }));

    if (!hasEslintConfig) {
      return {
        name: "lint",
        command: "npm run lint",
        passed: true,
        output:
          "Skipped: ESLint config not found to avoid interactive setup prompts.",
        skipped: true,
        skipReason: "missing_eslint_config",
      };
    }

    return this.executeStep({
      name: "lint",
      command: "npm run lint",
      projectDir,
    });
  };

  private executeStep = async ({
    name,
    command,
    projectDir,
  }: {
    name: string;
    command: string;
    projectDir: string;
  }): Promise<QAValidationStep> => {
    try {
      const output = execSync(command, {
        cwd: projectDir,
        encoding: "utf-8",
        stdio: "pipe",
        timeout: COMMAND_TIMEOUT_MS,
        env: { ...process.env, CI: "true" },
      });

      return {
        name,
        command,
        passed: true,
        output: output.slice(-MAX_OUTPUT_CHARS),
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown validation error";
      return {
        name,
        command,
        passed: false,
        output: message.slice(-MAX_OUTPUT_CHARS),
      };
    }
  };

  private fileExists = async ({
    projectDir,
    relativePath,
  }: {
    projectDir: string;
    relativePath: string;
  }): Promise<boolean> => {
    try {
      await fs.access(path.join(projectDir, relativePath));
      return true;
    } catch {
      return false;
    }
  };
}
