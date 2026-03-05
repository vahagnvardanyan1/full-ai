// ──────────────────────────────────────────────────────────
// Integration persistence layer
//
// Bridges the runtime in-memory integration store with MongoDB.
// All functions are fire-and-forget safe — DB errors are logged
// but never throw to the caller, keeping the OAuth flow intact
// even when MongoDB is unavailable.
// ──────────────────────────────────────────────────────────

import { connectDB } from "@/lib/db/connection";
import { IntegrationTokenModel } from "@/lib/db/models/integration-token";
import { logger } from "@/lib/logger";

type ServiceName = "github" | "jira" | "vercel";

export const saveIntegrationToDB = async ({
  deviceId,
  service,
  data,
}: {
  deviceId: string;
  service: ServiceName;
  data: Record<string, unknown>;
}): Promise<void> => {
  try {
    const db = await connectDB();
    if (!db) return;

    await IntegrationTokenModel.findOneAndUpdate(
      { deviceId },
      { $set: { [service]: data } },
      { upsert: true, new: true },
    );

    logger.info("Integration saved to DB", { service, deviceId });
  } catch (err) {
    logger.error("Failed to save integration to DB", {
      service,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};

export const deleteIntegrationFromDB = async ({
  deviceId,
  service,
}: {
  deviceId: string;
  service: ServiceName;
}): Promise<void> => {
  try {
    const db = await connectDB();
    if (!db) return;

    await IntegrationTokenModel.updateOne(
      { deviceId },
      { $unset: { [service]: "" } },
    );

    logger.info("Integration removed from DB", { service, deviceId });
  } catch (err) {
    logger.error("Failed to delete integration from DB", {
      service,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};

export const loadIntegrationsFromDB = async (
  deviceId: string,
): Promise<Record<string, unknown> | null> => {
  try {
    const db = await connectDB();
    if (!db) return null;

    const doc = await IntegrationTokenModel.findOne({ deviceId }).lean();
    if (!doc) return null;

    const { github, jira, vercel } = doc as Record<string, unknown>;
    return { github, jira, vercel };
  } catch (err) {
    logger.error("Failed to load integrations from DB", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
};
