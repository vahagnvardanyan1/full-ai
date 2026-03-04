// ──────────────────────────────────────────────────────────
// In-memory session store for conversation state
//
// In production, replace with Redis / a database.
// Sessions expire after 30 minutes of inactivity.
// ──────────────────────────────────────────────────────────

import type { Session, ConversationMessage } from "@/lib/agents/types";

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const store = new Map<string, Session>();

export function getSession(id: string): Session | undefined {
  const session = store.get(id);
  if (!session) return undefined;

  // Expire stale sessions
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    store.delete(id);
    return undefined;
  }
  return session;
}

export function createSession(id: string): Session {
  const session: Session = {
    id,
    messages: [],
    createdAt: Date.now(),
  };
  store.set(id, session);
  return session;
}

export function appendMessage(
  sessionId: string,
  msg: ConversationMessage,
): void {
  const session = store.get(sessionId);
  if (session) {
    session.messages.push(msg);
    // Keep last 20 messages to bound memory usage
    if (session.messages.length > 20) {
      session.messages = session.messages.slice(-20);
    }
  }
}
