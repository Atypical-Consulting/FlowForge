import type { GitflowContext } from "./types";

/**
 * Human-readable summary of a gitflow operation that just succeeded, in the
 * same voice as the sync toasts ("Pushed main to origin").
 *
 * `phase === null` means the operation was an abort.
 */
export function describeGitflowSuccess(
  context: Pick<GitflowContext, "operation" | "phase" | "name" | "result">,
): string {
  const { operation, phase, name, result } = context;
  const label = operation ?? "gitflow operation";
  const subject = name ? `${label} ${name}` : label;

  if (phase === "start") {
    return result
      ? `Started ${subject} — now on ${result}`
      : `Started ${subject}`;
  }

  if (phase === "finish") {
    if (operation === "feature") {
      return `Finished ${subject} into develop`;
    }
    const tagged = result ? `, tagged ${result}` : "";
    return `Finished ${subject} into main and develop${tagged}`;
  }

  return `Aborted ${subject}`;
}
