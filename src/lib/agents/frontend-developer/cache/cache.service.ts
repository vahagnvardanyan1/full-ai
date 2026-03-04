// ──────────────────────────────────────────────────────────
// Simplified in-memory cache — replaces v3's two-tier cache
// ──────────────────────────────────────────────────────────

import { createChildLogger } from "../utils/logger";
import type { RepoKnowledge } from "../types";

const log = createChildLogger("cache");

interface CacheEntry<T> {
  value: T;
  createdAt: number;
  ttl: number;
}

const DEFAULT_TTL = 3_600_000; // 1 hour

export class CacheService {
  private store = new Map<string, CacheEntry<unknown>>();

  private isExpired(entry: CacheEntry<unknown>): boolean {
    return Date.now() - entry.createdAt > entry.ttl;
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (this.isExpired(entry)) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    this.store.set(key, { value, createdAt: Date.now(), ttl: ttl ?? DEFAULT_TTL });
  }

  async invalidate(key: string): Promise<void> {
    this.store.delete(key);
  }

  // ── Convenience methods matching v3's CacheService API ──

  async getRepoContext(repoFullName: string): Promise<string | null> {
    return this.get<string>(`repo-context:${repoFullName}`);
  }

  async setRepoContext(repoFullName: string, context: string): Promise<void> {
    await this.set(`repo-context:${repoFullName}`, context, DEFAULT_TTL);
  }

  async getRepoKnowledge(repoFullName: string): Promise<RepoKnowledge | null> {
    return this.get<RepoKnowledge>(`repo-knowledge:${repoFullName}`);
  }

  async setRepoKnowledge(repoFullName: string, knowledge: RepoKnowledge): Promise<void> {
    await this.set(`repo-knowledge:${repoFullName}`, knowledge, DEFAULT_TTL * 5);
  }
}
