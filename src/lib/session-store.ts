// ──────────────────────────────────────────────────────────
// Session store — MongoDB-backed with in-memory fallback
//
// When MONGODB_URI is configured, sessions persist across
// server restarts and page reloads. Without it, the store
// falls back to the original in-memory Map (30-min TTL).
// ──────────────────────────────────────────────────────────

import { connectDB, isDBEnabled } from "@/lib/db/connection";
import { SessionModel } from "@/lib/db/models/session";
import type { Session, ConversationMessage } from "@/lib/agents/types";

const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_MESSAGES = 20;

// ── In-memory fallback ────────────────────────────────────

const memStore = new Map<string, Session>();

const memGetSession = (id: string): Session | undefined => {
  const session = memStore.get(id);
  if (!session) return undefined;
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    memStore.delete(id);
    return undefined;
  }
  return session;
};

const memCreateSession = (id: string): Session => {
  const session: Session = { id, messages: [], createdAt: Date.now() };
  memStore.set(id, session);
  return session;
};

const memAppendMessage = (sessionId: string, msg: ConversationMessage): void => {
  const session = memStore.get(sessionId);
  if (!session) return;
  session.messages.push(msg);
  if (session.messages.length > MAX_MESSAGES) {
    session.messages = session.messages.slice(-MAX_MESSAGES);
  }
};

// ── MongoDB-backed implementations ───────────────────────

const dbGetSession = async (id: string): Promise<Session | undefined> => {
  await connectDB();
  const doc = await SessionModel.findOne({ sessionId: id }).lean();
  if (!doc) return undefined;
  return {
    id: doc.sessionId,
    messages: doc.messages as ConversationMessage[],
    createdAt: doc.createdAt.getTime(),
  };
};

const dbCreateSession = async (id: string): Promise<Session> => {
  await connectDB();
  await SessionModel.findOneAndUpdate(
    { sessionId: id },
    { $setOnInsert: { sessionId: id, messages: [] } },
    { upsert: true, new: true },
  );
  return { id, messages: [], createdAt: Date.now() };
};

const dbAppendMessage = async (
  sessionId: string,
  msg: ConversationMessage,
): Promise<void> => {
  await connectDB();
  await SessionModel.findOneAndUpdate(
    { sessionId },
    {
      $push: {
        messages: {
          $each: [msg],
          $slice: -MAX_MESSAGES,
        },
      },
    },
  );
};

// ── Public API ────────────────────────────────────────────

export const getSession = async (id: string): Promise<Session | undefined> => {
  if (isDBEnabled()) {
    try {
      return await dbGetSession(id);
    } catch (err) {
      console.error("[session-store] DB read failed, falling back:", err);
    }
  }
  return memGetSession(id);
};

export const createSession = async (id: string): Promise<Session> => {
  if (isDBEnabled()) {
    try {
      return await dbCreateSession(id);
    } catch (err) {
      console.error("[session-store] DB create failed, falling back:", err);
    }
  }
  return memCreateSession(id);
};

export const appendMessage = async (
  sessionId: string,
  msg: ConversationMessage,
): Promise<void> => {
  // Always write to memory for immediate in-process access
  memAppendMessage(sessionId, msg);

  if (isDBEnabled()) {
    try {
      await dbAppendMessage(sessionId, msg);
    } catch (err) {
      console.error("[session-store] DB append failed:", err);
    }
  }
};
