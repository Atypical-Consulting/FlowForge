import type { BatchDeleteResult, GitflowStatus } from "../../bindings";
import { commands } from "../../bindings";

export interface BulkDeleteOptions {
  branchNames: string[];
  force: boolean;
}

export interface BulkOperationResult {
  succeeded: string[];
  failed: { name: string; error: string }[];
  totalDeleted: number;
  totalFailed: number;
}

/**
 * Get the set of branches protected from bulk deletion.
 *
 * Always protects the common integration branch names
 * (main/master/develop, plus development/dev when Gitflow is initialized).
 *
 * When available, also protects the actual current branch so the branch
 * the user is on can never be bulk-deleted. Note: the `GitflowContext`
 * binding does not (yet) expose the repository's configured Gitflow
 * main/develop branch names, so repositories using non-standard names
 * (e.g. develop="integration", main="trunk") are NOT protected here by
 * those custom names. The backend `batch_delete_branches` command remains
 * the authoritative guard (it refuses the current HEAD branch and, when
 * `force` is false, unmerged branches).
 */
export function getProtectedBranches(
  gitflowStatus: GitflowStatus | null,
): Set<string> {
  const protected_ = new Set(["main", "master", "develop"]);

  if (gitflowStatus?.context?.isInitialized) {
    protected_.add("development");
    protected_.add("dev");
  }

  // Defensively protect the current branch when known. The backend also
  // refuses to delete the current HEAD branch, but mirroring it here keeps
  // the UI from offering/auto-selecting it for deletion.
  const currentBranch = gitflowStatus?.context?.currentBranch;
  if (currentBranch) {
    protected_.add(currentBranch);
  }

  return protected_;
}

/**
 * Execute bulk branch deletion via the Rust backend.
 */
export async function bulkDeleteBranches(
  options: BulkDeleteOptions,
): Promise<BulkOperationResult> {
  try {
    const result = await commands.batchDeleteBranches(
      options.branchNames,
      options.force,
    );

    if (result.status === "ok") {
      const data: BatchDeleteResult = result.data;
      return {
        succeeded: data.results.filter((r) => r.deleted).map((r) => r.name),
        failed: data.results
          .filter((r) => !r.deleted)
          .map((r) => ({ name: r.name, error: r.error ?? "Unknown error" })),
        totalDeleted: data.totalDeleted,
        totalFailed: data.totalFailed,
      };
    }

    // Command-level error
    throw new Error(
      typeof result.error === "string"
        ? result.error
        : JSON.stringify(result.error),
    );
  } catch (e) {
    throw e instanceof Error ? e : new Error(String(e));
  }
}
