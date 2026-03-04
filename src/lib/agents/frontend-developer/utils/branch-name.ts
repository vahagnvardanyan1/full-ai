// ──────────────────────────────────────────────────────────
// Branch name generator — from ai-engineer-agent-v3
// Format: ai-agent/<type>/<issue>-<short-slug>
// ──────────────────────────────────────────────────────────

export type BranchType =
  | "feat"
  | "fix"
  | "test"
  | "docs"
  | "deps"
  | "refactor"
  | "ci"
  | "chore"
  | "perf"
  | "release";

interface BranchNameOptions {
  type: BranchType;
  issueNumber?: number;
  title: string;
}

export function makeBranchName(opts: BranchNameOptions): string {
  const prefix = `ai-agent/${opts.type}/`;
  const issueTag = opts.issueNumber ? `${opts.issueNumber}-` : "";
  const maxSlugLen = 50 - prefix.length - issueTag.length;
  const slug = slugify(opts.title, maxSlugLen);
  return `${prefix}${issueTag}${slug}`;
}

function slugify(text: string, maxLen: number): string {
  const stopWords = new Set([
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
    "being", "have", "has", "had", "do", "does", "did", "will", "would",
    "could", "should", "may", "might", "shall", "can", "need", "must",
    "that", "which", "who", "whom", "this", "these", "those",
    "it", "its", "we", "our", "you", "your", "they", "their",
    "all", "each", "every", "both", "few", "more", "most", "some",
    "such", "no", "not", "only", "very", "just", "about",
    "up", "out", "into", "over", "after", "before", "between",
    "through", "during", "without", "also", "then", "than",
    "so", "if", "when", "where", "how", "what", "why",
    "please", "implement", "create", "add", "make", "build", "write",
    "update", "change", "modify", "ensure", "handle", "support",
  ]);

  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .split(/[\s-]+/)
    .filter((w) => w.length > 0 && !stopWords.has(w))
    .join("-");

  if (!cleaned) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, maxLen);
  }

  if (cleaned.length <= maxLen) return cleaned;

  const truncated = cleaned.slice(0, maxLen);
  const lastHyphen = truncated.lastIndexOf("-");

  return lastHyphen > maxLen * 0.4
    ? truncated.slice(0, lastHyphen)
    : truncated.replace(/-$/, "");
}
