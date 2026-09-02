import type { commands, GitError, SyncResult } from "../../../bindings";
import { getErrorMessage } from "../../../core/lib/errors";

export type SyncOperation = "push" | "pull" | "fetch";

/** The `{ status: "ok" | "error" }` union returned by the sync bindings. */
export type SyncCommandResult = Awaited<
  ReturnType<typeof commands.pushToRemote>
>;

/** What a toast should show for a finished sync operation. */
export interface SyncOutcome {
  ok: boolean;
  message: string;
}

const OPERATION_LABEL: Record<SyncOperation, string> = {
  push: "Push",
  pull: "Pull",
  fetch: "Fetch",
};

function plural(count: number, noun: string, pluralNoun = `${noun}s`): string {
  return `${count} ${count === 1 ? noun : pluralNoun}`;
}

/**
 * Message for a successful push, built from what the backend actually sent.
 *
 * - "Nothing to push — feature/x is up to date with origin/feature/x"
 * - "Pushed feature/x to origin (3 commits)"
 * - "Pushed feature/x to origin (1 commit) — upstream set to origin/feature/x"
 */
export function formatPushSuccess(result: SyncResult): string {
  const { branch, remote } = result;
  if (!branch) {
    return `Pushed to ${remote}`;
  }
  const tracking = `${remote}/${branch}`;
  if (result.upToDate) {
    return `Nothing to push — ${branch} is up to date with ${tracking}`;
  }
  let message = `Pushed ${branch} to ${remote}`;
  if (result.commitsTransferred > 0) {
    message += ` (${plural(result.commitsTransferred, "commit")})`;
  }
  if (result.upstreamSet) {
    message += ` — upstream set to ${tracking}`;
  }
  return message;
}

/**
 * Message for a successful pull.
 *
 * - "Already up to date — main matches origin/main"
 * - "Pulled 3 commits into main"
 * - "Pulled 2 commits into main — merge staged, review and commit it"
 */
export function formatPullSuccess(result: SyncResult): string {
  const { branch, remote } = result;
  if (result.upToDate) {
    return branch
      ? `Already up to date — ${branch} matches ${remote}/${branch}`
      : "Already up to date";
  }
  const target = branch ? ` into ${branch}` : "";
  let message = `Pulled ${plural(result.commitsTransferred, "commit")}${target}`;
  if (result.message.startsWith("Merged")) {
    message += " — merge staged, review and commit it";
  }
  return message;
}

/**
 * Message for a successful fetch.
 *
 * - "Fetched origin — already up to date"
 * - "Fetched origin: 5 new commits, 2 updated branches"
 */
export function formatFetchSuccess(result: SyncResult): string {
  const { remote } = result;
  if (result.upToDate) {
    return `Fetched ${remote} — already up to date`;
  }
  return `Fetched ${remote}: ${plural(result.commitsTransferred, "new commit")}, ${plural(result.updatedRefs, "updated branch", "updated branches")}`;
}

export function formatSyncSuccess(
  operation: SyncOperation,
  result: SyncResult,
): string {
  switch (operation) {
    case "push":
      return formatPushSuccess(result);
    case "pull":
      return formatPullSuccess(result);
    case "fetch":
      return formatFetchSuccess(result);
  }
}

/**
 * Actionable message for a typed backend error.
 *
 * `remote` is the remote the operation was asked to use; it is the only
 * context available when the backend fails before producing a result.
 */
export function formatSyncError(
  operation: SyncOperation,
  error: GitError,
  remote: string,
): string {
  const label = OPERATION_LABEL[operation];
  switch (error.type) {
    case "PushRejected":
      return `Push rejected: ${error.message} — pull first, then push again`;
    case "AuthenticationFailed":
      return `${label} failed: authentication to ${remote} failed (${error.message}) — check your credentials or SSH key`;
    case "NetworkError":
      return `${label} failed: could not reach ${remote} — ${error.message}`;
    case "RemoteNotFound":
      return `${label} failed: remote "${remote}" is not configured`;
    case "OperationFailed":
      if (error.message.startsWith("No tracking branch found for ")) {
        const tracking = error.message.slice(
          "No tracking branch found for ".length,
        );
        return `${label} failed: ${tracking} does not exist on the remote — push the branch first`;
      }
      return `${label} failed: ${error.message}`;
    default:
      return `${label} failed: ${getErrorMessage(error)}`;
  }
}

/** Message for a result the backend returned with `success: false`. */
export function formatSyncFailure(
  operation: SyncOperation,
  result: SyncResult,
): string {
  return `${OPERATION_LABEL[operation]} failed: ${result.message}`;
}

/** Message for an unexpected exception (IPC failure, thrown error). */
export function formatSyncException(
  operation: SyncOperation,
  error: unknown,
): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `${OPERATION_LABEL[operation]} failed: ${detail}`;
}

/**
 * Turn a sync binding result into the toast to show, using only data the
 * backend derived from the operation itself.
 */
export function describeSyncResult(
  operation: SyncOperation,
  result: SyncCommandResult,
  remote: string,
): SyncOutcome {
  if (result.status === "error") {
    return {
      ok: false,
      message: formatSyncError(operation, result.error, remote),
    };
  }
  if (!result.data.success) {
    return { ok: false, message: formatSyncFailure(operation, result.data) };
  }
  return { ok: true, message: formatSyncSuccess(operation, result.data) };
}
