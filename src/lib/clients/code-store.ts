// ──────────────────────────────────────────────────────────
// In-memory store for generated code files
//
// Agents call write_code to produce actual source files.
// Files are tracked per orchestration request and returned
// to the frontend for display.
// ──────────────────────────────────────────────────────────

import { logger } from "@/lib/logger";

export interface CodeFile {
  id: string;
  filePath: string;
  language: string;
  code: string;
  description: string;
  createdBy: string;
  createdAt: string;
}

let counter = 0;
const filesByRequest = new Map<string, CodeFile[]>();

let activeRequestId: string | null = null;

export function setActiveCodeRequestId(id: string) {
  activeRequestId = id;
}

export function getFilesForRequest(requestId: string): CodeFile[] {
  return filesByRequest.get(requestId) ?? [];
}

export function getFilesForRequestByCreator(requestId: string, createdBy: string): CodeFile[] {
  return (filesByRequest.get(requestId) ?? []).filter(f => f.createdBy === createdBy);
}

/** Get all generated files for the currently active request (used by GitHub client to commit files) */
export function getFilesForCurrentRequest(): CodeFile[] {
  if (!activeRequestId) return [];
  return filesByRequest.get(activeRequestId) ?? [];
}

export function getFilesForCurrentRequestByCreator(createdBy: string): CodeFile[] {
  if (!activeRequestId) return [];
  return (filesByRequest.get(activeRequestId) ?? []).filter(
    (file) => file.createdBy === createdBy,
  );
}

export interface WriteCodeParams {
  file_path: string;
  language: string;
  code: string;
  description: string;
}

export function writeCode(params: WriteCodeParams, agentRole: string): CodeFile {
  counter++;
  const file: CodeFile = {
    id: `FILE-${counter}`,
    filePath: params.file_path,
    language: params.language,
    code: params.code,
    description: params.description,
    createdBy: agentRole,
    createdAt: new Date().toISOString(),
  };

  if (activeRequestId) {
    const existing = filesByRequest.get(activeRequestId) ?? [];
    existing.push(file);
    filesByRequest.set(activeRequestId, existing);
  }

  logger.info("Code file generated", {
    id: file.id,
    filePath: file.filePath,
    language: file.language,
    createdBy: file.createdBy,
  });

  return {
    id: file.id,
    filePath: file.filePath,
    language: file.language,
    code: file.code,
    description: file.description,
    createdBy: file.createdBy,
    createdAt: file.createdAt,
  };
}
