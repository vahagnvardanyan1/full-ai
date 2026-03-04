import * as fs from "fs/promises";
import * as path from "path";

import type { AgentRole } from "@/lib/agents/types";
import { logger } from "@/lib/logger";

type SkillRole = Extract<
  AgentRole,
  "product_manager" | "frontend_developer" | "qa" | "devops"
>;

interface ParsedSkill {
  name: string;
  description: string;
  body: string;
  filePath: string;
}

const ROLE_SKILL_DIRS: Record<SkillRole, string[]> = {
  product_manager: ["pm"],
  frontend_developer: ["frontend", "pm"],
  qa: ["qa"],
  devops: ["devops"],
};

const SKILLS_ROOT = path.join(process.cwd(), ".codex", "skills");
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

const listSkillFiles = async (role: SkillRole): Promise<string[]> => {
  const roleDirs = ROLE_SKILL_DIRS[role];
  const skillFiles: string[] = [];

  for (const dirName of roleDirs) {
    const absoluteDir = path.join(SKILLS_ROOT, dirName);

    try {
      const entries = await fs.readdir(absoluteDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const skillFile = path.join(absoluteDir, entry.name, "SKILL.md");

        try {
          await fs.access(skillFile);
          skillFiles.push(skillFile);
        } catch {
          // Ignore missing SKILL.md files.
        }
      }
    } catch {
      // Ignore missing namespace directory.
    }
  }

  return skillFiles;
};

export const buildRoleSkillContext = async (role: SkillRole): Promise<string> => {
  const skillFiles = await listSkillFiles(role);
  if (skillFiles.length === 0) return "";

  const parsedSkills = (await Promise.all(skillFiles.map((skillFile) => readSkillFile(skillFile)))).filter(
    (skill): skill is ParsedSkill => Boolean(skill),
  );

  if (parsedSkills.length === 0) return "";

  const skillSections = parsedSkills.map((skill) => {
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
    count: parsedSkills.length,
    skills: parsedSkills.map((skill) => skill.name),
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
