// ──────────────────────────────────────────────────────────
// Agent runner — shared logic that executes an OpenAI chat
// completion with tool calling, automatically handling the
// tool_calls → result → follow-up loop.
// ──────────────────────────────────────────────────────────

import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { getOpenAIClient } from "@/lib/clients/openai";
import { executeTool } from "@/lib/tools/executor";
import { logger } from "@/lib/logger";
import type { AgentRole, AgentResponse, ToolCall } from "./types";

const MODEL = "gpt-4o";
const MAX_TOOL_ROUNDS = 10;

export interface RunAgentOptions {
  role: AgentRole;
  systemPrompt: string;
  userMessage: string;
  tools: ChatCompletionTool[];
  /** Extra conversation context (optional) */
  history?: ChatCompletionMessageParam[];
}

/**
 * Run a single agent to completion, automatically executing any
 * tool calls the model requests and feeding results back until
 * the model produces a final text response.
 */
export async function runAgent(opts: RunAgentOptions): Promise<AgentResponse> {
  const openai = getOpenAIClient();
  const collectedToolCalls: ToolCall[] = [];

  // Build initial messages array
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: opts.systemPrompt },
    ...(opts.history ?? []),
    { role: "user", content: opts.userMessage },
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    logger.info(`Agent ${opts.role} — round ${round + 1}`, {
      messageCount: messages.length,
    });

    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages,
      tools: opts.tools.length > 0 ? opts.tools : undefined,
      tool_choice: opts.tools.length > 0 ? "auto" : undefined,
    });

    const choice = completion.choices[0];
    if (!choice) throw new Error("OpenAI returned no choices");

    const assistantMessage = choice.message;
    messages.push(assistantMessage);

    if (
      choice.finish_reason === "stop" ||
      !assistantMessage.tool_calls?.length
    ) {
      return {
        agent: opts.role,
        summary: assistantMessage.content ?? "",
        toolCalls: collectedToolCalls,
        detail: assistantMessage.content ?? "",
        prUrl: extractPrUrl(collectedToolCalls),
      };
    }

    // Process every tool call in parallel
    const toolResults = await Promise.all(
      assistantMessage.tool_calls.map(async (tc) => {
        const args = JSON.parse(tc.function.arguments);
        try {
          const result = await executeTool(tc.function.name, args, opts.role);
          collectedToolCalls.push({
            tool: tc.function.name,
            arguments: args,
            result,
          });
          return {
            role: "tool" as const,
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          };
        } catch (err) {
          const errorMsg =
            err instanceof Error ? err.message : String(err);
          logger.error(`Tool ${tc.function.name} failed`, {
            error: errorMsg,
          });
          collectedToolCalls.push({
            tool: tc.function.name,
            arguments: args,
            result: { error: errorMsg },
          });
          return {
            role: "tool" as const,
            tool_call_id: tc.id,
            content: JSON.stringify({ error: errorMsg }),
          };
        }
      }),
    );

    // Feed tool results back to the model
    messages.push(...toolResults);
  }

  // Safety: if we exhausted rounds, return what we have
  logger.warn(`Agent ${opts.role} hit MAX_TOOL_ROUNDS`, {
    rounds: MAX_TOOL_ROUNDS,
  });
  return {
    agent: opts.role,
    summary: "Agent reached maximum tool call rounds.",
    toolCalls: collectedToolCalls,
    detail: "The agent was stopped after reaching the tool call limit.",
    prUrl: extractPrUrl(collectedToolCalls),
  };
}

const extractPrUrl = (toolCalls: ToolCall[]): string | undefined => {
  const prCall = toolCalls.find(
    (tc) => tc.tool === "create_github_pull_request" && tc.result,
  );
  if (!prCall) return undefined;

  const result = prCall.result as Record<string, unknown>;
  if (typeof result.html_url === "string") return result.html_url;
  if (typeof result.url === "string") return result.url;
  return undefined;
};
