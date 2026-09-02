import { useIncidentStore } from "@/lib/store/use-incident-store";
import { getModelContext } from "@/lib/webmcp/model-context";
import { incidentOsTools } from "@/lib/webmcp/tools";
import type { ToolExecuteResult } from "@/lib/webmcp/tools";
import type { ToolName } from "@/types";
import { isAbortError, throwIfAborted } from "./abort";
import { waitForHumanApproval } from "./approval";
import { nextAgentId, nextAgentTimestamp } from "./clock";
import { ingestSuccessfulTool } from "./ingest-tools";
import type { ApprovalDecision } from "./run-options";
import { applyWorkspaceFocus } from "./workspace-focus";

/** In-app callers increment this before going through a registered WebMCP execute. */
let localInvokeDepth = 0;

function runningSummary(tool: ToolName): string {
  switch (tool) {
    case "get_investigation_context":
      return "Reading page investigation context";
    case "get_incident":
      return "Loading incident context";
    case "get_service":
      return "Inspecting service health";
    case "query_metrics":
      return "Querying metrics";
    case "search_logs":
      return "Searching logs";
    case "search_traces":
      return "Searching traces";
    case "get_trace":
      return "Inspecting trace";
    case "get_deployments":
      return "Loading deployments";
    case "compare_periods":
      return "Comparing periods";
    case "propose_rollback":
      return "Requesting rollback approval";
    case "rollback_deployment":
      return "Rolling back deployment";
    case "add_incident_note":
      return "Adding incident note";
    default: {
      const _exhaustive: never = tool;
      return _exhaustive;
    }
  }
}

function asInputObject(input: unknown): Record<string, unknown> {
  if (input !== null && typeof input === "object" && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  return {};
}

function asToolExecuteResult(value: unknown): ToolExecuteResult {
  if (
    value !== null &&
    typeof value === "object" &&
    "ok" in value &&
    typeof (value as { ok: unknown }).ok === "boolean"
  ) {
    return value as ToolExecuteResult;
  }
  if (typeof value === "string") {
    try {
      return asToolExecuteResult(JSON.parse(value) as unknown);
    } catch {
      return { ok: true, summary: value, data: value };
    }
  }
  return {
    ok: true,
    summary: "Tool completed",
    data: value,
  };
}

function documentModelContext(): ModelContext | undefined {
  return getModelContext();
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function proposalOutcome(
  base: ToolExecuteResult,
  decision: ApprovalDecision | "pending",
): ToolExecuteResult {
  const data = asRecord(base.data);
  const service = String(data.service ?? "");
  const targetVersion = String(data.targetVersion ?? "");
  switch (decision) {
    case "approved":
      return {
        ok: true,
        summary: `Human approved rollback of ${service} to ${targetVersion}.`,
        data: { ...data, status: "approved" },
      };
    case "rejected":
      return {
        ok: true,
        summary: `Human rejected the rollback of ${service} to ${targetVersion}.`,
        data: { ...data, status: "rejected" },
      };
    case "pending":
      return {
        ok: true,
        summary: `Still waiting for human approval for ${service} → ${targetVersion}.`,
        data: { ...data, status: "pending_approval" },
      };
    default: {
      const _exhaustive: never = decision;
      return _exhaustive;
    }
  }
}

async function settleExternalProposal(
  result: ToolExecuteResult,
  signal?: AbortSignal,
): Promise<ToolExecuteResult> {
  const approval = useIncidentStore.getState().approval;
  if (approval.pendingAction && approval.approved) {
    return proposalOutcome(result, "approved");
  }
  if (!approval.pendingAction) {
    return proposalOutcome(result, "rejected");
  }
  try {
    const decision = await waitForHumanApproval(signal);
    return proposalOutcome(result, decision);
  } catch (error) {
    if (isAbortError(error)) {
      return proposalOutcome(result, "pending");
    }
    throw error;
  }
}

export async function executeIncidentTool(
  name: ToolName,
  input: unknown,
  signal?: AbortSignal,
  options?: { ingest?: boolean },
): Promise<ToolExecuteResult> {
  throwIfAborted(signal);
  const store = useIncidentStore.getState();
  const shouldIngest = options?.ingest ?? localInvokeDepth === 0;
  const id = nextAgentId("act");
  store.addActivity({
    id,
    timestamp: nextAgentTimestamp(),
    tool: name,
    status: "running",
    summary: runningSummary(name),
  });
  try {
    let result = await incidentOsTools[name].execute(input);
    if (name === "propose_rollback" && result.ok && shouldIngest) {
      result = await settleExternalProposal(result, signal);
    } else {
      throwIfAborted(signal);
    }
    store.updateActivity(id, {
      status: result.ok ? "success" : "error",
      summary: result.summary,
      result: result.data,
    });
    if (result.ok) {
      applyWorkspaceFocus(name, input, result);
    }
    if (result.ok && shouldIngest) {
      ingestSuccessfulTool(name, input, result);
    }
    return result;
  } catch (error) {
    throwIfAborted(signal);
    const message = error instanceof Error ? error.message : "Tool failed";
    useIncidentStore.getState().updateActivity(id, {
      status: "error",
      summary: message,
    });
    throw error;
  }
}

export async function invokeIncidentTool(
  name: ToolName,
  input: unknown,
  signal?: AbortSignal,
): Promise<ToolExecuteResult> {
  const modelContext = documentModelContext();
  const listRegistered = modelContext?.getTools;
  if (typeof listRegistered === "function") {
    try {
      const registered = (await listRegistered.call(modelContext)).find((tool) => tool.name === name);
      if (registered) {
        localInvokeDepth += 1;
        try {
          const raw = await registered.execute(asInputObject(input), {
            signal: signal ?? new AbortController().signal,
          });
          return asToolExecuteResult(raw);
        } finally {
          localInvokeDepth -= 1;
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
    }
  }
  return executeIncidentTool(name, input, signal, { ingest: false });
}
