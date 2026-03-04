// ──────────────────────────────────────────────────────────
// Request-scoped context using AsyncLocalStorage
//
// Stores a per-request device ID so the integration store
// can key configs per user without threading the ID through
// every function signature in the call chain.
//
// Usage in API routes:
//   const deviceId = request.cookies.get("device-id")?.value ?? "default";
//   return runWithDeviceId(deviceId, async () => { ... });
// ──────────────────────────────────────────────────────────

import { AsyncLocalStorage } from "node:async_hooks";

const deviceIdStorage = new AsyncLocalStorage<string>();

/**
 * Run a function with a device ID bound to the async context.
 * All downstream async calls (agents, clients, store) can
 * read it via `getCurrentDeviceId()`.
 */
export function runWithDeviceId<T>(deviceId: string, fn: () => T): T {
  return deviceIdStorage.run(deviceId, fn);
}

/**
 * Read the device ID for the current request context.
 * Falls back to "default" when called outside of a request
 * (e.g. during module initialization or tests).
 */
export function getCurrentDeviceId(): string {
  return deviceIdStorage.getStore() ?? "default";
}

/**
 * Read the device-id cookie from a NextRequest.
 * Use this in API route handlers before calling runWithDeviceId.
 */
export function getDeviceIdFromCookies(
  cookies: { get: (name: string) => { value: string } | undefined },
): string {
  return cookies.get("device-id")?.value ?? "default";
}
