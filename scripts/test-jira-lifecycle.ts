/**
 * Jira Integration Test — Full Lifecycle
 *
 * Creates a real Jira issue and transitions it through every
 * column on the board:
 *   TO DO → IN PROGRESS → IN REVIEW → QA → DONE
 *
 * After the full cycle, verifies the final status and optionally
 * deletes the test issue to keep the board clean.
 *
 * Usage:
 *   npm run test:jira              (run full flow, keep issue on board)
 *   npm run test:jira -- --cleanup (run full flow, then delete the issue)
 */
import fs from "node:fs";
import path from "node:path";

// Load .env before any app imports that read process.env
const envPath = path.resolve(import.meta.dirname ?? __dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

import {
  isJiraConfigured,
  createJiraIssue,
  transitionJiraIssue,
  getJiraIssue,
  getJiraIssues,
  mapJiraStatusToLocal,
} from "@/lib/clients/jira";

import type { TaskStatus } from "@/lib/agents/types";

// ── Helpers ────────────────────────────────────────────────

const PASS = "✅";
const FAIL = "❌";
const INFO = "ℹ️";
const ARROW = "→";

let passed = 0;
let failed = 0;

const assert = (condition: boolean, label: string, detail?: string) => {
  if (condition) {
    console.log(`  ${PASS} ${label}`);
    passed++;
  } else {
    console.log(`  ${FAIL} ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
};

const TRANSITION_DELAY_SEC = 8;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const countdown = async (seconds: number, message: string) => {
  process.stdout.write(`    ${message} `);
  for (let i = seconds; i > 0; i--) {
    process.stdout.write(`${i}s `);
    await sleep(1000);
  }
  process.stdout.write("\n");
};

const deleteJiraIssue = async (issueKey: string) => {
  const baseUrl = process.env.JIRA_BASE_URL!.replace(/\/+$/, "");
  const email = process.env.JIRA_EMAIL!;
  const token = process.env.JIRA_API_TOKEN!;
  const auth = Buffer.from(`${email}:${token}`).toString("base64");

  const res = await fetch(`${baseUrl}/rest/api/3/issue/${issueKey}`, {
    method: "DELETE",
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    },
  });

  return res.ok;
};

// Fetch available transitions for debugging when a transition fails
const getAvailableTransitions = async (issueKey: string) => {
  const baseUrl = process.env.JIRA_BASE_URL!.replace(/\/+$/, "");
  const email = process.env.JIRA_EMAIL!;
  const token = process.env.JIRA_API_TOKEN!;
  const auth = Buffer.from(`${email}:${token}`).toString("base64");

  const res = await fetch(
    `${baseUrl}/rest/api/3/issue/${issueKey}/transitions`,
    {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
    },
  );

  if (!res.ok) return [];
  const data = (await res.json()) as {
    transitions: Array<{ id: string; name: string; to: { name: string } }>;
  };
  return data.transitions.map((t) => `${t.name} ${ARROW} ${t.to.name}`);
};

// ── Test Functions ─────────────────────────────────────────

const testConfiguration = async () => {
  console.log("\n1️⃣  Test: Jira Configuration");

  const configured = await isJiraConfigured();
  assert(configured, "JIRA_* env vars are all present");

  if (!configured) {
    console.log(
      `\n${FAIL} Cannot continue — set JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY in .env`,
    );
    process.exit(1);
  }

  const baseUrl = process.env.JIRA_BASE_URL!;
  assert(
    baseUrl.startsWith("https://"),
    `JIRA_BASE_URL starts with https:// (${baseUrl.slice(0, 30)}...)`,
  );

  assert(
    !!process.env.JIRA_PROJECT_KEY,
    `Project key: ${process.env.JIRA_PROJECT_KEY}`,
  );
};

const testCreateIssue = async (): Promise<string> => {
  console.log("\n2️⃣  Test: Create Jira Issue");

  const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
  const result = await createJiraIssue({
    title: `[TEST] Integration test — ${timestamp}`,
    description: [
      "This is an automated integration test issue created by test-jira-lifecycle.ts.",
      "",
      "It tests the full Jira lifecycle: creation, transitions through all statuses, and cleanup.",
      "",
      `Created at: ${timestamp}`,
      "This issue will be automatically deleted after the test completes.",
    ].join("\n"),
    type: "task",
    priority: "low",
    assignedTo: "qa-test-runner",
    labels: ["integration-test", "automated"],
  });

  assert(!!result.issueKey, `Issue created: ${result.issueKey}`);
  assert(!!result.issueId, `Issue ID: ${result.issueId}`);
  assert(
    result.url.includes(result.issueKey),
    `URL contains key: ${result.url}`,
  );

  console.log(`\n  ${INFO} Issue is now on the board in TO DO column.`);
  await countdown(TRANSITION_DELAY_SEC, "Check your board now — issue should be in TO DO!");

  return result.issueKey;
};

const testFetchIssue = async (issueKey: string) => {
  console.log("\n3️⃣  Test: Fetch Single Issue");

  const issue = await getJiraIssue(issueKey);

  assert(issue.key === issueKey, `Key matches: ${issue.key}`);
  assert(
    issue.summary.includes("[TEST]"),
    `Summary contains [TEST]: "${issue.summary.slice(0, 50)}"`,
  );
  const expectedTypes = ["task", "задача"];
  assert(
    expectedTypes.includes(issue.issueType.toLowerCase()),
    `Type is Task: ${issue.issueType}`,
  );
  assert(issue.priority === "Low", `Priority is Low: ${issue.priority}`);
  assert(
    issue.labels.includes("integration-test"),
    `Has integration-test label: [${issue.labels.join(", ")}]`,
  );

  const localStatus = issue.localStatus;
  assert(
    localStatus === "open",
    `Initial local status is "open": ${localStatus} (Jira: "${issue.status}")`,
  );
};

const testFetchIssuesList = async (issueKey: string) => {
  console.log("\n4️⃣  Test: Fetch Issues List (JQL)");

  const issues = await getJiraIssues(
    `key = "${issueKey}" ORDER BY created DESC`,
  );

  assert(issues.length >= 1, `JQL returned ${issues.length} issue(s)`);
  const found = issues.find((i) => i.key === issueKey);
  assert(!!found, `Test issue found in results: ${found?.key}`);
};

const testStatusMappings = () => {
  console.log("\n5️⃣  Test: Status Mapping (local ↔ Jira)");

  const cases: Array<{ jiraStatus: string; expected: TaskStatus }> = [
    // English names
    { jiraStatus: "To Do", expected: "open" },
    { jiraStatus: "Backlog", expected: "open" },
    { jiraStatus: "In Progress", expected: "in_progress" },
    { jiraStatus: "In Review", expected: "review" },
    { jiraStatus: "Code Review", expected: "review" },
    { jiraStatus: "QA", expected: "testing" },
    { jiraStatus: "QA In Progress", expected: "testing" },
    { jiraStatus: "Done", expected: "done" },
    { jiraStatus: "Closed", expected: "done" },
    // Russian locale names
    { jiraStatus: "К выполнению", expected: "open" },
    { jiraStatus: "В работе", expected: "in_progress" },
    { jiraStatus: "На проверке", expected: "review" },
    { jiraStatus: "Тестирование", expected: "testing" },
    { jiraStatus: "Готово", expected: "done" },
    { jiraStatus: "Закрыто", expected: "done" },
  ];

  for (const { jiraStatus, expected } of cases) {
    const result = mapJiraStatusToLocal(jiraStatus);
    assert(
      result === expected,
      `"${jiraStatus}" ${ARROW} "${result}" (expected "${expected}")`,
    );
  }
};

const testFullLifecycleTransitions = async (issueKey: string) => {
  console.log("\n6️⃣  Test: Full Lifecycle Transitions");
  console.log(`  ${INFO} Expected board flow: TO DO → IN PROGRESS → IN REVIEW → QA → DONE`);

  // First, discover available transitions so we know what the board supports
  const initialTransitions = await getAvailableTransitions(issueKey);
  console.log(`  ${INFO} Available transitions from initial state: ${initialTransitions.join(", ") || "none"}`);

  // The pipeline status sequence mirrors the actual board columns:
  //   TO DO (open) → IN PROGRESS → IN REVIEW → QA → DONE
  const lifecycle: Array<{ target: TaskStatus; label: string }> = [
    { target: "in_progress", label: "TO DO → IN PROGRESS (PM assigns, FE starts coding)" },
    { target: "review", label: "IN PROGRESS → IN REVIEW (FE opens PR for review)" },
    { target: "testing", label: "IN REVIEW → QA (QA agent picks up verification)" },
    { target: "done", label: "QA → DONE (all verified, ready to ship)" },
  ];

  for (const { target, label } of lifecycle) {
    console.log(`\n  ${INFO} Transitioning: ${label}`);

    const transitioned = await transitionJiraIssue(issueKey, target);

    if (!transitioned) {
      const available = await getAvailableTransitions(issueKey);
      console.log(`    Available transitions from current state: ${available.join(", ") || "none"}`);
      assert(false, `Transition to "${target}" succeeded`, "No matching transition found — check board column names");
      continue;
    }

    assert(true, `Transition to "${target}" succeeded`);

    // Verify the issue landed in the expected status
    await sleep(500);
    const issue = await getJiraIssue(issueKey);
    const localStatus = issue.localStatus;
    assert(
      localStatus === target,
      `Verified status is "${target}": local="${localStatus}" (Jira="${issue.status}")`,
    );

    // Visible pause so you can watch the card move on the board
    await countdown(TRANSITION_DELAY_SEC, `Waiting before next transition — check your board now!`);
  }
};

const testFinalState = async (issueKey: string) => {
  console.log("\n7️⃣  Test: Verify Final State");

  const issue = await getJiraIssue(issueKey);

  assert(
    issue.localStatus === "done",
    `Final local status is "done": ${issue.localStatus} (Jira: "${issue.status}")`,
  );

  assert(
    issue.labels.includes("integration-test"),
    "Labels preserved through transitions",
  );

  assert(issue.summary.includes("[TEST]"), "Summary unchanged through transitions");
};

const testCleanup = async (issueKey: string) => {
  console.log("\n8️⃣  Test: Cleanup");

  const deleted = await deleteJiraIssue(issueKey);
  assert(deleted, `Test issue ${issueKey} deleted`);

  if (deleted) {
    try {
      await getJiraIssue(issueKey);
      assert(false, "Issue no longer fetchable after deletion", "Issue still exists");
    } catch {
      assert(true, "Confirmed issue is gone (404 expected)");
    }
  }
};

// ── Main ───────────────────────────────────────────────────

const main = async () => {
  const willCleanup = process.argv.includes("--cleanup");

  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║     Jira Integration Test — Full Lifecycle       ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log(`  Project: ${process.env.JIRA_PROJECT_KEY}`);
  console.log(`  Base URL: ${process.env.JIRA_BASE_URL}`);
  console.log(`  Cleanup: ${willCleanup ? "enabled (--cleanup)" : "disabled (issue stays on board)"}`);
  console.log(`  Delay between transitions: ${TRANSITION_DELAY_SEC}s (watch your board!)`);

  let issueKey: string | null = null;

  try {
    // Phase 1: Configuration checks
    await testConfiguration();

    // Phase 2: Pure mapping tests (no API calls)
    testStatusMappings();

    // Phase 3: Create a test issue
    issueKey = await testCreateIssue();

    // Phase 4: Fetch and verify the created issue
    await testFetchIssue(issueKey);

    // Phase 5: Verify JQL search
    await testFetchIssuesList(issueKey);

    // Phase 6: Transition through the full lifecycle
    await testFullLifecycleTransitions(issueKey);

    // Phase 7: Verify the final state
    await testFinalState(issueKey);

    // Phase 8: Keep or clean up
    if (!willCleanup) {
      console.log(`\n8️⃣  Keeping issue on board: ${issueKey}`);
      console.log(`  ${INFO} Issue stays in DONE column so you can review the full flow.`);
      console.log(`  ${INFO} To delete later, run: npm run test:jira -- --cleanup`);
    } else {
      await testCleanup(issueKey);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n${FAIL} Unexpected error: ${msg}`);
    failed++;

    if (issueKey) {
      console.log(`\n  ${INFO} Issue ${issueKey} is still on the board (not deleted on error).`);
    }
  }

  // Summary
  console.log("\n══════════════════════════════════════════════════");
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log("══════════════════════════════════════════════════\n");

  process.exit(failed > 0 ? 1 : 0);
};

main();
