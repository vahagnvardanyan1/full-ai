import * as fs from "fs/promises";
import * as path from "path";

import type { AgentRole } from "@/lib/agents/types";
import { logger } from "@/lib/logger";

type SkillRole = Extract<
  AgentRole,
  | "product_manager"
  | "frontend_developer"
  | "qa"
  | "devops"
  | "researcher"
  | "architect"
  | "coder"
  | "reviewer"
  | "tester"
  | "security_architect"
  | "performance_engineer"
  | "coordinator"
>;

interface ParsedSkill {
  name: string;
  description: string;
  body: string;
  filePath: string;
}

const CODEX_SKILLS_ROOT = path.join(process.cwd(), ".codex", "skills");
const RUFLO_SKILLS_ROOT = path.join(process.cwd(), ".agents", "skills");

const CODEX_ROLE_DIRS: Partial<Record<SkillRole, string[]>> = {
  product_manager: ["pm"],
  frontend_developer: ["frontend", "pm"],
  qa: ["qa"],
  devops: ["devops"],
  coder: ["frontend", "pm"],
  tester: ["qa"],
  coordinator: ["pm"],
};

const RUFLO_ROLE_DIRS: Partial<Record<SkillRole, string[]>> = {
  product_manager: ["sparc-methodology", "agent-planner"],
  frontend_developer: ["agent-coder", "agent-implementer-sparc-coder"],
  qa: ["agent-tester", "agent-tdd-london-swarm", "verification-quality"],
  devops: ["agent-ops-cicd-github", "workflow-automation"],
  researcher: ["agent-researcher", "agent-analyze-code-quality", "performance-analysis"],
  architect: ["agent-architecture", "agent-arch-system-design", "sparc-methodology"],
  coder: ["agent-coder", "agent-implementer-sparc-coder", "pair-programming"],
  reviewer: ["agent-reviewer", "agent-code-review-swarm", "agent-analyze-code-quality"],
  tester: ["agent-tester", "agent-tdd-london-swarm", "agent-production-validator"],
  security_architect: ["agent-v3-security-architect", "security-audit"],
  performance_engineer: ["agent-v3-performance-engineer", "v3-performance-optimization", "agent-performance-optimizer"],
  coordinator: ["agent-hierarchical-coordinator", "swarm-orchestration", "agent-coordination"],
};

const MAX_SKILL_BODY_CHARS = 3500;

const parseFrontmatter = (markdown: string): { name: string; description: string; body: string } => {
  const frontmatterMatch = markdown.match(/^---\n([\s\S]*?)\n---\n?/);

  if (!frontmatterMatch) {
    return {
      name: "unnamed-skill",
      description: "No description provided",
      body: markdown.trim(),
    };
  }

  const rawFrontmatter = frontmatterMatch[1];
  const body = markdown.slice(frontmatterMatch[0].length).trim();

  const nameMatch = rawFrontmatter.match(/(?:^|\n)name:\s*["']?(.+?)["']?(?:\n|$)/);
  const descriptionMatch = rawFrontmatter.match(/(?:^|\n)description:\s*["']?(.+?)["']?(?:\n|$)/);

  return {
    name: nameMatch?.[1]?.trim() || "unnamed-skill",
    description: descriptionMatch?.[1]?.trim() || "No description provided",
    body,
  };
};

const readSkillFile = async (filePath: string): Promise<ParsedSkill | null> => {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = parseFrontmatter(raw);
    return {
      ...parsed,
      filePath,
      body: parsed.body.slice(0, MAX_SKILL_BODY_CHARS),
    };
  } catch (error) {
    logger.warn("Failed to read SKILL.md file", {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

const listSkillFilesFromRoot = async ({
  root,
  dirNames,
}: {
  root: string;
  dirNames: string[];
}): Promise<string[]> => {
  const skillFiles: string[] = [];

  for (const dirName of dirNames) {
    const absoluteDir = path.join(root, dirName);

    try {
      const stat = await fs.stat(absoluteDir);

      if (stat.isDirectory()) {
        const skillFile = path.join(absoluteDir, "SKILL.md");
        try {
          await fs.access(skillFile);
          skillFiles.push(skillFile);
        } catch {
          const entries = await fs.readdir(absoluteDir, { withFileTypes: true });
          for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const nestedSkill = path.join(absoluteDir, entry.name, "SKILL.md");
            try {
              await fs.access(nestedSkill);
              skillFiles.push(nestedSkill);
            } catch {
              // no SKILL.md here
            }
          }
        }
      }
    } catch {
      // directory doesn't exist
    }
  }

  return skillFiles;
};

const listSkillFiles = async (role: SkillRole): Promise<string[]> => {
  const codexDirs = CODEX_ROLE_DIRS[role] ?? [];
  const rufloDirs = RUFLO_ROLE_DIRS[role] ?? [];

  const [codexFiles, rufloFiles] = await Promise.all([
    listSkillFilesFromRoot({ root: CODEX_SKILLS_ROOT, dirNames: codexDirs }),
    listSkillFilesFromRoot({ root: RUFLO_SKILLS_ROOT, dirNames: rufloDirs }),
  ]);

  return [...codexFiles, ...rufloFiles];
};

export const buildRoleSkillContext = async (role: SkillRole): Promise<string> => {
  const skillFiles = await listSkillFiles(role);
  if (skillFiles.length === 0) return "";

  const parsedSkills = (
    await Promise.all(skillFiles.map((skillFile) => readSkillFile(skillFile)))
  ).filter((skill): skill is ParsedSkill => Boolean(skill));

  if (parsedSkills.length === 0) return "";

  const seen = new Set<string>();
  const deduped = parsedSkills.filter((skill) => {
    if (seen.has(skill.name)) return false;
    seen.add(skill.name);
    return true;
  });

  const skillSections = deduped.map((skill) => {
    return [
      `### Skill: ${skill.name}`,
      `Description: ${skill.description}`,
      `Source: ${skill.filePath}`,
      "Instructions:",
      skill.body,
    ].join("\n");
  });

  logger.info("Loaded role skills", {
    role,
    count: deduped.length,
    skills: deduped.map((skill) => skill.name),
  });

  return [
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "PROJECT SKILLS (LOADED FROM SKILL.md)",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "Use these skills when relevant. Keep core task scope and role boundaries.",
    "",
    skillSections.join("\n\n"),
  ].join("\n");
};
