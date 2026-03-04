// ──────────────────────────────────────────────────────────
// MongoDB connection — singleton cached across hot reloads
// in Next.js dev mode (global cache prevents multiple
// connections from being opened on every file change).
// ──────────────────────────────────────────────────────────

import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI ?? "";

if (!MONGODB_URI) {
  console.warn(
    "[db] MONGODB_URI is not set — persistence is disabled. " +
      "Add MONGODB_URI to your .env to enable MongoDB.",
  );
}

// Extend global to persist the promise across hot reloads
declare global {
  // eslint-disable-next-line no-var
  var _mongooseConn: Promise<typeof mongoose> | undefined;
}

let cached = global._mongooseConn;

export const connectDB = async (): Promise<typeof mongoose | null> => {
  if (!MONGODB_URI) return null;

  if (cached) return cached;

  cached = mongoose.connect(MONGODB_URI, {
    bufferCommands: false,
  });

  global._mongooseConn = cached;

  cached.catch((err) => {
    global._mongooseConn = undefined;
    cached = undefined;
    console.error("[db] MongoDB connection failed:", err);
  });

  return cached;
};

export const isDBEnabled = (): boolean => Boolean(MONGODB_URI);
