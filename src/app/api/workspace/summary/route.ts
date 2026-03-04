// ──────────────────────────────────────────────────────────
// GET /api/workspace/summary
// Returns recent activity, pipeline runs, and aggregate stats
// derived from real workflow run documents in MongoDB.
// ──────────────────────────────────────────────────────────

import { NextResponse } from "next/server";

import { connectDB, isDBEnabled } from "@/lib/db/connection";
import { WorkflowRunModel } from "@/lib/db/models/workflow-run";

export interface ActivityItem {
  agent: string;
  action: string;
  runPrompt: string;
  prUrl: string | null;
  runCreatedAt: string;
}

export interface PipelineRunSummary {
  requestId: string;
  prompt: string;
  taskCount: number;
  agentCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceSummaryResponse {
  recentActivity: ActivityItem[];
  pipelineRuns: PipelineRunSummary[];
  stats: {
    totalTasks: number;
    totalRuns: number;
    uptimePercent: number | null;
  };
}

export const GET = async (): Promise<NextResponse> => {
  if (!isDBEnabled()) {
    return NextResponse.json(
      { error: "Persistence is disabled — MONGODB_URI is not configured." },
      { status: 503 },
    );
  }

  await connectDB();

  const [recentRuns, [aggStats]] = await Promise.all([
    WorkflowRunModel.find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .select("requestId userMessage status tasks agentResults phases createdAt updatedAt")
      .lean(),
    WorkflowRunModel.aggregate<{ totalTasks: number; totalRuns: number; completedRuns: number; failedRuns: number }>([
      {
        $group: {
          _id: null,
          totalTasks: { $sum: { $size: { $ifNull: ["$tasks", []] } } },
          totalRuns: { $sum: 1 },
          completedRuns: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          failedRuns: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const pipelineRuns: PipelineRunSummary[] = recentRuns.slice(0, 5).map((run) => ({
    requestId: run.requestId,
    prompt: run.userMessage,
    taskCount: (run.tasks ?? []).length,
    agentCount: (run.agentResults ?? []).length,
    status: run.status,
    createdAt: (run.createdAt as Date).toISOString(),
    updatedAt: (run.updatedAt as Date).toISOString(),
  }));

  const recentActivity: ActivityItem[] = recentRuns
    .flatMap((run) =>
      (run.agentResults ?? [])
        .filter((r) => r.summary?.trim())
        .map((result) => ({
          agent: result.agent,
          action: result.summary,
          runPrompt: run.userMessage,
          prUrl: result.prUrl ?? null,
          runCreatedAt: (run.createdAt as Date).toISOString(),
        })),
    )
    .slice(0, 10);

  const finishedRuns = (aggStats?.completedRuns ?? 0) + (aggStats?.failedRuns ?? 0);
  const uptimePercent = finishedRuns > 0
    ? Math.round(((aggStats?.completedRuns ?? 0) / finishedRuns) * 100)
    : null;

  return NextResponse.json({
    recentActivity,
    pipelineRuns,
    stats: {
      totalTasks: aggStats?.totalTasks ?? 0,
      totalRuns: aggStats?.totalRuns ?? 0,
      uptimePercent,
    },
  } satisfies WorkspaceSummaryResponse);
};
