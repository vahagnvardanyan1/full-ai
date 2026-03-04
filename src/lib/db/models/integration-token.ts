// ──────────────────────────────────────────────────────────
// IntegrationToken model
//
// One document per device. Stores all OAuth tokens and configs
// for GitHub, GitLab, Jira, and Vercel so connections survive
// server restarts. On connect → upsert. On disconnect → $unset.
// ──────────────────────────────────────────────────────────

import mongoose, { Schema, type Document } from "mongoose";

const tokenFields = {
  accessToken: { type: String, required: true },
  refreshToken: String,
  connectedAt: { type: Number, required: true },
  expiresAt: Number,
};

const GitHubSchema = new Schema(
  {
    ...tokenFields,
    owner: String,
    repo: String,
    login: { type: String, required: true },
    avatarUrl: String,
  },
  { _id: false },
);

const JiraSchema = new Schema(
  {
    ...tokenFields,
    cloudId: { type: String, required: true },
    siteUrl: { type: String, required: true },
    siteName: { type: String, required: true },
    projectKey: String,
    email: String,
  },
  { _id: false },
);

const VercelSchema = new Schema(
  {
    ...tokenFields,
    teamId: String,
    projectId: { type: String, required: true },
  },
  { _id: false },
);

const IntegrationTokenSchema = new Schema(
  {
    deviceId: { type: String, required: true, unique: true, index: true },
    github: GitHubSchema,
    jira: JiraSchema,
    vercel: VercelSchema,
  },
  {
    timestamps: true,
    collection: "integration_tokens",
  },
);

export interface IntegrationTokenDocument extends Document {
  deviceId: string;
  github?: {
    accessToken: string;
    owner?: string;
    repo?: string;
    login: string;
    avatarUrl?: string;
    connectedAt: number;
  };
  jira?: {
    accessToken: string;
    refreshToken?: string;
    cloudId: string;
    siteUrl: string;
    siteName: string;
    projectKey?: string;
    email?: string;
    connectedAt: number;
    expiresAt?: number;
  };
  vercel?: {
    accessToken: string;
    teamId?: string;
    projectId: string;
    connectedAt: number;
  };
}

export const IntegrationTokenModel =
  (mongoose.models.IntegrationToken as mongoose.Model<IntegrationTokenDocument>) ??
  mongoose.model<IntegrationTokenDocument>("IntegrationToken", IntegrationTokenSchema);
