import type { AgentResponse, ToolCall } from "../../types";
import type {
  QAAutomationDecision,
  QAContext,
  QAValidationResult,
} from "../types";

const MOCK_PATTERNS = [
  "vi.fn(",
  "jest.fn(",
  "mockImplementation(",
  "mockResolvedValue(",
  "mockRejectedValue(",
  "msw",
  "nock(",
];

const stringifyArguments = ({
  args,
}: {
  args: Record<string, unknown>;
}): string => {
  try {
    return JSON.stringify(args);
  } catch {
    return "";
  }
};

const hasMockUsageInToolCalls = ({
  toolCalls,
}: {
  toolCalls: ToolCall[];
}): boolean => {
  return toolCalls.some((toolCall) => {
    if (toolCall.tool !== "write_code") return false;
    const argsContent = stringifyArguments({
      args: toolCall.arguments,
    }).toLowerCase();
    return MOCK_PATTERNS.some((pattern) =>
      argsContent.includes(pattern.toLowerCase()),
    );
  });
};

interface ToolCallResult {
  url?: string;
  prNumber?: number;
  issueNumber?: number;
  error?: string;
}

const extractToolCallResult = ({
  toolCalls,
  toolName,
}: {
  toolCalls: ToolCall[];
  toolName: string;
}): ToolCallResult | undefined =>
  toolCalls.find((tc) => tc.tool === toolName)?.result as
    | ToolCallResult
    | undefined;

export class QAReportService {
  build = ({
    context,
    decision,
    validation,
    agentResponse,
  }: {
    context: QAContext;
    decision: QAAutomationDecision;
    validation: QAValidationResult;
    agentResponse: AgentResponse;
  }): AgentResponse => {
    const automationSkipped = !decision.shouldAutomate;

    const hasMockUsage = hasMockUsageInToolCalls({
      toolCalls: agentResponse.toolCalls,
    });

    const prResult = extractToolCallResult({
      toolCalls: agentResponse.toolCalls,
      toolName: "create_github_pull_request",
    });

    const issueResult = extractToolCallResult({
      toolCalls: agentResponse.toolCalls,
      toolName: "create_github_issue",
    });

    const artifactSummaryLine = this.buildArtifactSummaryLine({
      automationSkipped,
      prResult,
      issueResult,
    });

    const summaryLines: string[] = [
      validation.passed
        ? "QA verification complete: validation gates passed."
        : "QA verification complete: validation gates found failures.",
      `Automation decision: ${decision.shouldAutomate ? "required" : "not required"}.`,
      `No-mock policy: ${hasMockUsage ? "violation detected in generated artifacts" : "no violations detected"}.`,
      "Merge policy: soft-gate (report findings, do not auto-block merge).",
      artifactSummaryLine,
    ];

    const artifactDetailSection = this.buildArtifactDetailSection({
      automationSkipped,
      prResult,
      issueResult,
    });

    const detailSections: string[] = [
      `## QA Strategy\n${decision.rationale}`,
      `## Automation Decision\n- Should automate: ${decision.shouldAutomate}\n- Candidate areas:\n${decision.candidateAreas.map((item) => `  - ${item}`).join("\n") || "  - None identified"}`,
      `## Regression Risks\n${decision.regressionRisks.map((item) => `- ${item}`).join("\n") || "- None identified"}`,
      `## Manual Checklist\n${decision.manualChecklist.map((item) => `- ${item}`).join("\n") || "- None provided"}`,
      `## Validation Results\n${validation.steps.map((step) => `- ${step.name}: ${step.skipped ? `skipped (${step.skipReason || "n/a"})` : step.passed ? "passed" : "failed"}`).join("\n")}`,
      `## Merge Recommendation\nSoft-gate only. Share QA findings for developer action; do not enforce automatic merge blocking in this flow.`,
      artifactDetailSection,
      `## Frontend Context Reviewed\n${context.extractedFiles.map((file) => `- \`${file.filePath}\``).join("\n") || "- No generated files provided to QA context."}`,
      `## QA Agent Output\n${agentResponse.detail}`,
    ];

    return {
      ...agentResponse,
      summary: summaryLines.join(" "),
      detail: detailSections.join("\n\n"),
    };
  };

  private buildArtifactSummaryLine = ({
    automationSkipped,
    prResult,
    issueResult,
  }: {
    automationSkipped: boolean;
    prResult: ToolCallResult | undefined;
    issueResult: ToolCallResult | undefined;
  }): string => {
    if (automationSkipped) {
      const issuePart = issueResult?.url
        ? `QA Issue: ${issueResult.url}`
        : issueResult?.error
          ? `QA Issue creation failed: ${issueResult.error}`
          : "QA Issue: not created (expected — agent should have created a verification issue).";
      return `QA PR: intentionally skipped (automation not required). ${issuePart}`;
    }

    if (prResult?.url) {
      return `QA PR: ${prResult.url}`;
    }

    if (prResult?.error) {
      return `QA PR creation failed: ${prResult.error}`;
    }

    return "QA PR: not created (unexpected — automation was required but no PR tool call was found).";
  };

  private buildArtifactDetailSection = ({
    automationSkipped,
    prResult,
    issueResult,
  }: {
    automationSkipped: boolean;
    prResult: ToolCallResult | undefined;
    issueResult: ToolCallResult | undefined;
  }): string => {
    if (automationSkipped) {
      const issueLines = issueResult?.url
        ? [
            `- Verification Issue: ${issueResult.url}`,
            `- Issue Number: #${issueResult.issueNumber ?? "unknown"}`,
          ]
        : issueResult?.error
          ? [`- Issue Creation Error: ${issueResult.error}`]
          : ["- Issue: Not created (agent did not call create_github_issue as expected)."];

      return [
        "## QA Artifact",
        "- Mode: Issue-based verification (no PR)",
        "- Reason: Automation was determined not required for this change.",
        ...issueLines,
      ].join("\n");
    }

    if (prResult?.url) {
      return [
        "## QA Artifact",
        "- Mode: Automation (PR with tests)",
        `- PR URL: ${prResult.url}`,
        `- PR Number: #${prResult.prNumber ?? "unknown"}`,
      ].join("\n");
    }

    if (prResult?.error) {
      return `## QA Artifact\n- Mode: Automation (PR with tests)\n- Error: ${prResult.error}`;
    }

    return "## QA Artifact\n- Mode: Automation (PR with tests)\n- Status: Not created (automation was required but no PR tool call was detected).";
  };
}
