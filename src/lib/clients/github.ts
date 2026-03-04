// ──────────────────────────────────────────────────────────
// GitHub client — wraps Octokit for issue / PR operations
//
// PR creation automatically:
//   1. Creates a branch from base
//   2. Commits all in-memory generated files
//   3. Opens the real PR
//
// Falls back to simulation when not configured or on error.
// ──────────────────────────────────────────────────────────

import { Octokit } from "@octokit/rest";
import { logger } from "@/lib/logger";
import {
  getFilesForCurrentRequest,
  getFilesForCurrentRequestByCreator,
} from "@/lib/clients/code-store";

let instance: Octokit | null = null;
let simulatedIssueCounter = 100;
let simulatedPRCounter = 10;

function isConfigured(): boolean {
  return !!(
    process.env.GITHUB_TOKEN &&
    process.env.GITHUB_OWNER &&
    process.env.GITHUB_REPO
  );
}

function getOctokit(): Octokit {
  if (!instance) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GITHUB_TOKEN is not set");
    instance = new Octokit({ auth: token });
  }
  return instance;
}

function ownerRepo() {
  const owner = process.env.GITHUB_OWNER ?? "demo-org";
  const repo = process.env.GITHUB_REPO ?? "demo-repo";
  return { owner, repo };
}

// ── Issues ───────────────────────────────────────────────

export interface CreateIssueParams {
  title: string;
  body: string;
  labels?: string[];
  assignees?: string[];
}

export async function createGitHubIssue(params: CreateIssueParams) {
  const { owner, repo } = ownerRepo();
  logger.info("Creating GitHub issue", { title: params.title, owner, repo });

  if (isConfigured()) {
    try {
      const octokit = getOctokit();
      const { data } = await octokit.issues.create({
        owner,
        repo,
        title: params.title,
        body: params.body,
        labels: params.labels,
        assignees: params.assignees,
      });

      logger.info("GitHub issue created", {
        issueNumber: data.number,
        url: data.html_url,
      });

      return {
        issueNumber: data.number,
        url: data.html_url,
        title: data.title,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn("GitHub issue creation failed, falling back to simulation", { error: msg });
    }
  }

  simulatedIssueCounter++;
  const num = simulatedIssueCounter;
  return {
    issueNumber: num,
    url: `https://github.com/${owner}/${repo}/issues/${num}`,
    title: params.title,
    simulated: true,
  };
}

// ── Comments ─────────────────────────────────────────────

export interface AddCommentParams {
  issueNumber: number;
  body: string;
}

export async function addGitHubComment(params: AddCommentParams) {
  const { owner, repo } = ownerRepo();
  logger.info("Adding GitHub comment", { issueNumber: params.issueNumber, owner, repo });

  if (isConfigured()) {
    try {
      const octokit = getOctokit();
      const { data } = await octokit.issues.createComment({
        owner,
        repo,
        issue_number: params.issueNumber,
        body: params.body,
      });

      return { commentId: data.id, url: data.html_url };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn("GitHub comment failed, falling back to simulation", { error: msg });
    }
  }

  return {
    commentId: Date.now(),
    url: `https://github.com/${owner}/${repo}/issues/${params.issueNumber}#issuecomment-${Date.now()}`,
    simulated: true,
  };
}

// ── Pull Requests ────────────────────────────────────────

export interface CreatePullRequestParams {
  title: string;
  body: string;
  head: string;
  base: string;
  created_by?: string;
  file_paths?: string[];
}

const pickFilesForPR = (params: CreatePullRequestParams) => {
  const baseFiles = params.created_by
    ? getFilesForCurrentRequestByCreator(params.created_by)
    : getFilesForCurrentRequest();

  if (!params.file_paths || params.file_paths.length === 0) {
    return baseFiles;
  }

  const allowedPaths = new Set(params.file_paths);
  return baseFiles.filter((file) => allowedPaths.has(file.filePath));
};

/**
 * Creates a real GitHub PR by:
 *   1. Ensuring the base branch exists (creates initial commit if repo is empty)
 *   2. Creating blobs + tree + commit for all generated code files
 *   3. Creating the head branch
 *   4. Opening the PR
 */
export async function createGitHubPullRequest(params: CreatePullRequestParams) {
  const { owner, repo } = ownerRepo();
  logger.info("Creating GitHub pull request", { title: params.title, owner, repo });
  const files = pickFilesForPR(params);

  if (files.length === 0) {
    return {
      error: "No files available for PR creation using the provided scope.",
      simulated: true,
      prNumber: 0,
      url: "",
      title: params.title,
    };
  }

  if (isConfigured()) {
    try {
      const octokit = getOctokit();

      logger.info("PR: files from code store", { fileCount: files.length, filePaths: files.map(f => f.filePath) });

      // 1. Ensure the base branch exists. If repo is empty, bootstrap it.
      let baseSha: string;
      let baseTreeSha: string | undefined;

      try {
        logger.info("PR: checking base branch", { base: params.base });
        const { data: baseRef } = await octokit.git.getRef({
          owner,
          repo,
          ref: `heads/${params.base}`,
        });
        baseSha = baseRef.object.sha;
        logger.info("PR: base branch found", { baseSha });

        const { data: baseCommit } = await octokit.git.getCommit({
          owner,
          repo,
          commit_sha: baseSha,
        });
        baseTreeSha = baseCommit.tree.sha;
      } catch (refErr) {
        const refMsg = refErr instanceof Error ? refErr.message : String(refErr);
        logger.info("PR: base branch not found, trying default-branch fallback", {
          base: params.base,
          error: refMsg,
        });

        // Most failures here are "base branch missing", not "empty repo".
        // First fallback: create base from existing default branch.
        let createdFromDefault = false;
        try {
          const { data: repoInfo } = await octokit.repos.get({ owner, repo });
          const defaultBranch = repoInfo.default_branch;
          const { data: defaultRef } = await octokit.git.getRef({
            owner,
            repo,
            ref: `heads/${defaultBranch}`,
          });

          if (defaultBranch !== params.base) {
            await octokit.git.createRef({
              owner,
              repo,
              ref: `refs/heads/${params.base}`,
              sha: defaultRef.object.sha,
            });
            logger.info("PR: created missing base branch from default branch", {
              base: params.base,
              defaultBranch,
            });
          }
          createdFromDefault = true;
        } catch (defaultBranchErr) {
          const defaultMsg =
            defaultBranchErr instanceof Error ? defaultBranchErr.message : String(defaultBranchErr);
          logger.info("PR: default-branch fallback unavailable, bootstrapping repo", {
            error: defaultMsg,
          });
        }

        if (!createdFromDefault) {
          // Last resort: bootstrap initial commit safely.
          // If README already exists, include sha to avoid GitHub API "sha wasn't supplied".
          let existingReadmeSha: string | undefined;
          try {
            const { data: existingReadme } = await octokit.repos.getContent({
              owner,
              repo,
              path: "README.md",
            });
            if (!Array.isArray(existingReadme) && "sha" in existingReadme) {
              existingReadmeSha = existingReadme.sha;
            }
          } catch {
            // README does not exist yet; creation path below is fine.
          }

          const { data: created } = await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: "README.md",
            message: "Initial commit",
            content: Buffer.from(`# ${repo}\n\nInitialized by AI Team.\n`).toString("base64"),
            ...(existingReadmeSha ? { sha: existingReadmeSha } : {}),
          });
          logger.info("PR: repo initialized via Contents API", { commitSha: created.commit.sha });

          const { data: repoInfo } = await octokit.repos.get({ owner, repo });
          const defaultBranch = repoInfo.default_branch;
          if (defaultBranch !== params.base) {
            const { data: defaultRef } = await octokit.git.getRef({
              owner,
              repo,
              ref: `heads/${defaultBranch}`,
            });
            await octokit.git.createRef({
              owner,
              repo,
              ref: `refs/heads/${params.base}`,
              sha: defaultRef.object.sha,
            });
            logger.info("PR: created base branch from bootstrapped default", {
              base: params.base,
              defaultBranch,
            });
          }
        }

        // Fetch base branch after fallback path.
        const { data: newBaseRef } = await octokit.git.getRef({
          owner,
          repo,
          ref: `heads/${params.base}`,
        });
        baseSha = newBaseRef.object.sha;

        const { data: newBaseCommit } = await octokit.git.getCommit({
          owner,
          repo,
          commit_sha: baseSha,
        });
        baseTreeSha = newBaseCommit.tree.sha;
        logger.info("PR: base branch ready", { base: params.base, sha: baseSha });
      }

      // 2. Create blobs for each generated file
      logger.info("PR: creating blobs", { count: files.length });
      const treeItems: {
        path: string;
        mode: "100644";
        type: "blob";
        sha: string;
      }[] = [];

      for (const file of files) {
        const { data: blob } = await octokit.git.createBlob({
          owner,
          repo,
          content: file.code,
          encoding: "utf-8",
        });
        treeItems.push({
          path: file.filePath,
          mode: "100644",
          type: "blob",
          sha: blob.sha,
        });
        logger.info("PR: blob created", { path: file.filePath, sha: blob.sha });
      }

      // 3. Create a new tree (on top of base tree if it exists)
      logger.info("PR: creating tree", { itemCount: treeItems.length, baseTreeSha });
      const { data: newTree } = await octokit.git.createTree({
        owner,
        repo,
        ...(baseTreeSha ? { base_tree: baseTreeSha } : {}),
        tree: treeItems,
      });

      // 4. Create a commit with the base as parent
      logger.info("PR: creating commit", { treeSha: newTree.sha, parentSha: baseSha });
      const { data: newCommit } = await octokit.git.createCommit({
        owner,
        repo,
        message: params.title,
        tree: newTree.sha,
        parents: [baseSha],
      });

      // 5. Create (or update) the head branch
      logger.info("PR: creating branch", { head: params.head, commitSha: newCommit.sha });
      try {
        await octokit.git.createRef({
          owner,
          repo,
          ref: `refs/heads/${params.head}`,
          sha: newCommit.sha,
        });
      } catch {
        await octokit.git.updateRef({
          owner,
          repo,
          ref: `heads/${params.head}`,
          sha: newCommit.sha,
          force: true,
        });
      }

      // 6. Create the pull request (or find existing one for this branch)
      logger.info("PR: opening pull request", { head: params.head, base: params.base });
      let prNumber: number;
      let prUrl: string;
      let prTitle: string;

      try {
        const { data: pr } = await octokit.pulls.create({
          owner,
          repo,
          title: params.title,
          body: params.body,
          head: params.head,
          base: params.base,
        });
        prNumber = pr.number;
        prUrl = pr.html_url;
        prTitle = pr.title;
      } catch (prErr) {
        // PR already exists for this branch — find it and update it
        const prMsg = prErr instanceof Error ? prErr.message : String(prErr);
        if (prMsg.includes("already exists")) {
          logger.info("PR: already exists, finding and updating", { head: params.head });
          const { data: existing } = await octokit.pulls.list({
            owner,
            repo,
            head: `${owner}:${params.head}`,
            base: params.base,
            state: "open",
          });
          if (existing.length > 0) {
            const pr = existing[0];
            // Update title and body
            await octokit.pulls.update({
              owner,
              repo,
              pull_number: pr.number,
              title: params.title,
              body: params.body,
            });
            prNumber = pr.number;
            prUrl = pr.html_url;
            prTitle = params.title;
          } else {
            throw prErr; // not the error we expected
          }
        } else {
          throw prErr;
        }
      }

      logger.info("GitHub PR ready", {
        prNumber,
        url: prUrl,
        filesCommitted: files.length,
      });

      return {
        prNumber,
        url: prUrl,
        title: prTitle,
        filesCommitted: files.length,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      logger.error("GitHub PR creation failed", { error: msg, stack });
      // Surface the error to the AI agent so it's visible in the UI
      return {
        error: msg,
        simulated: true,
        prNumber: 0,
        url: "",
        title: params.title,
      };
    }
  }

  simulatedPRCounter++;
  const num = simulatedPRCounter;
  return {
    prNumber: num,
    url: `https://github.com/${owner}/${repo}/pull/${num}`,
    title: params.title,
    head: params.head,
    base: params.base,
    simulated: true,
  };
}
