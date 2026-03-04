// ──────────────────────────────────────────────────────────
// GitHub Service — from ai-engineer-agent-v3
// Adapted: uses env vars GITHUB_TOKEN/OWNER/REPO like full-ai
// ──────────────────────────────────────────────────────────

import { Octokit } from "@octokit/rest";
import simpleGit, { SimpleGit } from "simple-git";
import * as tmp from "tmp-promise";
import * as fs from "fs/promises";
import * as path from "path";
import { createChildLogger } from "../utils/logger";
import type { RepoInfo, CodeGenerationResponse } from "../types";

const log = createChildLogger("github-service");

let octokitInstance: Octokit | null = null;

function getToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is not set");
  return token;
}

function getOctokit(): Octokit {
  if (!octokitInstance) {
    octokitInstance = new Octokit({ auth: getToken() });
  }
  return octokitInstance;
}

function ownerRepo(): { owner: string; repo: string } {
  return {
    owner: process.env.GITHUB_OWNER ?? "demo-org",
    repo: process.env.GITHUB_REPO ?? "demo-repo",
  };
}

export class GitHubService {
  // ── Repository Operations ──────────────────────────────

  async getRepoInfo(): Promise<RepoInfo> {
    const { owner, repo } = ownerRepo();
    const octokit = getOctokit();
    const { data } = await octokit.repos.get({ owner, repo });
    return {
      owner,
      name: repo,
      fullName: data.full_name,
      defaultBranch: data.default_branch,
    };
  }

  async getRepoTree(branch: string): Promise<string[]> {
    const { owner, repo } = ownerRepo();
    const octokit = getOctokit();
    const { data } = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: branch,
      recursive: "true",
    });
    return data.tree
      .filter((item) => item.type === "blob")
      .map((item) => item.path!);
  }

  async getFileContent(filePath: string, ref?: string): Promise<string> {
    const { owner, repo } = ownerRepo();
    const octokit = getOctokit();
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: filePath,
      ...(ref && { ref }),
    });

    if ("content" in data && data.content) {
      return Buffer.from(data.content, "base64").toString("utf-8");
    }
    throw new Error(`Cannot read file: ${filePath}`);
  }

  async getRepoContext(): Promise<string> {
    const { owner, repo } = ownerRepo();
    log.info({ owner, repo }, "Building repository context");

    const repoInfo = await this.getRepoInfo();
    const files = await this.getRepoTree(repoInfo.defaultBranch);

    const contextFiles = [
      "README.md", "package.json", "tsconfig.json", ".eslintrc.json",
      "Cargo.toml", "go.mod", "requirements.txt", "pyproject.toml",
    ];

    // Show deeper file tree so the planner can see existing components/pages
    // Group by important directories (src/, app/, pages/, components/)
    const importantDirs = ["src/", "app/", "pages/", "components/", "lib/", "hooks/", "utils/", "styles/"];
    const topLevel = files.filter((f) => !f.includes("/") || f.split("/").length <= 2);
    const deepFiles = files.filter((f) => {
      const depth = f.split("/").length;
      return depth > 2 && depth <= 5 && importantDirs.some((d) => f.startsWith(d));
    });

    // Combine and deduplicate, limit to 200 entries
    const treeEntries = [...new Set([...topLevel, ...deepFiles])].slice(0, 200);

    const contextParts: string[] = [
      `Repository: ${repoInfo.fullName}`,
      `Default branch: ${repoInfo.defaultBranch}`,
      `Total files: ${files.length}`,
      `\nFile structure:\n${treeEntries.join("\n")}`,
      files.length > 200 ? `\n... and ${files.length - 200} more files` : "",
    ];

    for (const cf of contextFiles) {
      if (files.includes(cf)) {
        try {
          const content = await this.getFileContent(cf);
          contextParts.push(`\n--- ${cf} ---\n${content.slice(0, 2000)}`);
        } catch {
          // skip unreadable files
        }
      }
    }

    return contextParts.join("\n");
  }

  /**
   * Search the repo tree for files matching keywords (case-insensitive).
   * Used for pre-planning context scan — find existing components,
   * pages, or features before the planner creates duplicates.
   */
  async findRelatedFiles(
    repoTree: string[],
    keywords: string[],
    maxResults = 30,
  ): Promise<string[]> {
    const lowerKeywords = keywords.map((k) => k.toLowerCase());
    const matches = repoTree.filter((f) => {
      const lower = f.toLowerCase();
      // Skip non-source files
      if (lower.includes("node_modules") || lower.includes("dist") || lower.includes(".git/")) return false;
      return lowerKeywords.some((kw) => lower.includes(kw));
    });
    return matches.slice(0, maxResults);
  }

  /**
   * Read the content of multiple files for context building.
   * Returns a map of filename → content (truncated to maxCharsPerFile).
   * Silently skips files that can't be read.
   */
  async readMultipleFiles(
    filePaths: string[],
    maxCharsPerFile = 3000,
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    for (const filePath of filePaths) {
      try {
        const content = await this.getFileContent(filePath);
        result.set(filePath, content.slice(0, maxCharsPerFile));
      } catch {
        // File unreadable — skip
      }
    }
    return result;
  }

  // ── Clone & Branch ─────────────────────────────────────

  async cloneRepo(branch: string): Promise<{ dir: string; git: SimpleGit }> {
    const { owner, repo } = ownerRepo();
    const token = getToken();
    const tmpDir = await tmp.dir({ unsafeCleanup: true });
    const cloneUrl = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;

    const git = simpleGit();
    await git.clone(cloneUrl, tmpDir.path, ["--branch", branch, "--depth", "50"]);

    const repoGit = simpleGit(tmpDir.path);
    await repoGit.addConfig("user.email", "ai-agent@automated.dev");
    await repoGit.addConfig("user.name", "AI Engineer Agent");

    log.info({ dir: tmpDir.path }, "Cloned repository");
    return { dir: tmpDir.path, git: repoGit };
  }

  async createBranch(git: SimpleGit, branchName: string): Promise<void> {
    await git.checkoutLocalBranch(branchName);
    log.info({ branch: branchName }, "Created branch");
  }

  async applyChanges(
    repoDir: string,
    git: SimpleGit,
    changes: CodeGenerationResponse[],
  ): Promise<{ applied: string[]; skipped: { file: string; reason: string }[] }> {
    const applied: string[] = [];
    const skipped: { file: string; reason: string }[] = [];

    for (const change of changes) {
      try {
        // Sanitize filename — strip leading slashes, .., and whitespace
        const sanitized = change.filename
          .replace(/\.\.\//g, "")
          .replace(/^\/+/, "")
          .trim();

        if (!sanitized || sanitized.includes("..")) {
          skipped.push({ file: change.filename, reason: "Invalid or unsafe file path" });
          continue;
        }

        const filePath = path.join(repoDir, sanitized);
        const targetDir = path.dirname(filePath);

        // Ensure the parent directory exists — handle file/dir conflicts
        await this.ensureDirectory(targetDir);

        // If the target path itself is an existing directory but we need a file there,
        // remove the directory (e.g. LLM changed from dir/index.tsx to single file)
        try {
          const stat = await fs.stat(filePath);
          if (stat.isDirectory()) {
            log.warn({ file: sanitized }, "File path conflicts with existing directory, removing directory");
            await fs.rm(filePath, { recursive: true, force: true });
          }
        } catch {
          // File doesn't exist yet — that's fine
        }

        await fs.writeFile(filePath, change.code, "utf-8");
        await git.add(sanitized);
        applied.push(sanitized);
        log.info({ file: sanitized }, "Applied change");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error({ file: change.filename, error: msg }, "Failed to apply change — skipping file");
        skipped.push({ file: change.filename, reason: msg });
      }
    }

    if (skipped.length > 0) {
      log.warn({ skippedCount: skipped.length, skipped }, "Some files could not be applied");
    }

    return { applied, skipped };
  }

  /**
   * Recursively ensure a directory exists, handling the case where a FILE
   * exists at a path where we need a DIRECTORY (the EEXIST bug).
   */
  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "EEXIST" || code === "ENOTDIR") {
        // A file exists where we need a directory — walk up to find the conflicting file
        const parts = dirPath.split(path.sep);
        let current = "";
        for (const part of parts) {
          current = current ? path.join(current, part) : part;
          try {
            const stat = await fs.stat(current);
            if (stat.isFile()) {
              log.warn({ path: current }, "File conflicts with required directory — removing file to create directory");
              await fs.rm(current, { force: true });
              break;
            }
          } catch {
            break; // Path doesn't exist yet — rest of mkdir will create it
          }
        }
        // Retry mkdir after removing the conflicting file
        await fs.mkdir(dirPath, { recursive: true });
      } else {
        throw err;
      }
    }
  }

  async commitAndPush(git: SimpleGit, message: string, branch: string): Promise<void> {
    const protectedBranches = ["main", "master", "develop", "production"];
    if (protectedBranches.includes(branch)) {
      throw new Error(`SAFETY: Refusing to push to protected branch '${branch}'.`);
    }

    // Commit — check if there's actually something to commit
    const status = await git.status();
    if (status.staged.length === 0 && status.modified.length === 0 && status.not_added.length === 0) {
      log.warn("Nothing to commit — staging all changes");
      await git.add(".");
    }

    await git.commit(message);

    // ── Sync with remote feature branch before pushing ──
    // The rebase step (Step 8) only fetches main. If someone pushed
    // new commits to the feature branch (e.g. manual system-prompt fix),
    // our local branch is behind origin/<feature-branch>.
    // Fetch the feature branch and rebase our commit on top.
    try {
      await git.fetch("origin", branch);
      // Check if remote branch exists and has diverged
      try {
        await git.rebase([`origin/${branch}`]);
        log.info({ branch }, "Rebased onto remote feature branch");
      } catch {
        // Rebase conflict — try merge instead
        try { await git.rebase(["--abort"]); } catch { /* ignore */ }
        try {
          await git.merge([`origin/${branch}`]);
          log.info({ branch }, "Merged remote feature branch");
        } catch {
          // Merge also conflicts — abort and continue (force-with-lease will handle)
          try { await git.merge(["--abort"]); } catch { /* ignore */ }
          log.warn({ branch }, "Could not rebase or merge remote feature branch — will attempt force push");
        }
      }
    } catch {
      // Branch doesn't exist on remote yet — that's fine, first push
      log.info({ branch }, "Remote feature branch not found — first push");
    }

    // Push with retry (network can be flaky)
    const MAX_PUSH_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_PUSH_RETRIES; attempt++) {
      try {
        await git.push("origin", branch, ["--set-upstream"]);
        log.info({ branch, attempt }, "Pushed successfully");
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (attempt === MAX_PUSH_RETRIES) {
          // Last resort: force push on feature branch (safe since it's our own branch)
          log.warn({ branch, error: msg }, "Push failed after retries — attempting force push");
          try {
            await git.push("origin", branch, ["--set-upstream", "--force-with-lease"]);
            log.info({ branch }, "Force push succeeded");
            return;
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (_forceErr) {
            throw new Error(`Failed to push after ${MAX_PUSH_RETRIES} retries: ${msg}`);
          }
        }
        log.warn({ branch, attempt, error: msg }, "Push failed, retrying...");
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
  }

  // ── Pull Request ───────────────────────────────────────

  async createPullRequest(
    title: string,
    body: string,
    head: string,
    base: string,
    draft = false,
  ): Promise<{ prNumber: number; prUrl: string }> {
    const { owner, repo } = ownerRepo();
    const octokit = getOctokit();

    // Truncate body if it exceeds GitHub's limit (65536 chars)
    const safeBody = body.length > 60000 ? body.slice(0, 60000) + "\n\n---\n*PR body truncated due to length.*" : body;

    // Retry wrapper for transient GitHub API errors
    const MAX_PR_RETRIES = 3;
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_PR_RETRIES; attempt++) {
      try {
        // First, check if a PR already exists for this head → base
        const { data: existing } = await octokit.pulls.list({
          owner, repo, head: `${owner}:${head}`, base, state: "open",
        });

        if (existing.length > 0) {
          const pr = existing[0];
          log.info({ pr: pr.number }, "PR already exists — updating");
          await octokit.pulls.update({ owner, repo, pull_number: pr.number, title, body: safeBody });
          return { prNumber: pr.number, prUrl: pr.html_url };
        }

        // Create new PR
        const { data } = await octokit.pulls.create({
          owner, repo, title, body: safeBody, head, base, draft,
        });
        log.info({ pr: data.number, draft }, "Created pull request");
        return { prNumber: data.number, prUrl: data.html_url };
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);

        // If "already exists" race condition, retry (the list check above will find it)
        if (msg.includes("already exists") || msg.includes("A pull request already exists")) {
          log.info({ attempt }, "PR creation race condition — retrying to find existing PR");
          continue;
        }

        // If 422 "No commits between", the branch might not have diverged
        if (msg.includes("No commits between") || msg.includes("no commits")) {
          log.error("No commits between base and head — nothing to create a PR for");
          throw new Error(
            `Cannot create PR: no commits between '${base}' and '${head}'. ` +
            `Ensure code was committed to the feature branch.`,
          );
        }

        // Transient server errors — retry
        if (msg.includes("502") || msg.includes("503") || msg.includes("timeout")) {
          log.warn({ attempt, error: msg }, "GitHub API transient error — retrying");
          await new Promise((r) => setTimeout(r, 3000 * attempt));
          continue;
        }

        // Non-retryable error
        throw err;
      }
    }

    throw lastError ?? new Error("Failed to create PR after retries");
  }

  async commentOnIssue(number: number, body: string): Promise<void> {
    const { owner, repo } = ownerRepo();
    const octokit = getOctokit();
    await octokit.issues.createComment({ owner, repo, issue_number: number, body });
    log.info({ issue: number }, "Commented on issue");
  }
}
