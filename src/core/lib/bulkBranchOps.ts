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
 * Always protects main/master/develop. If Gitflow is initialized,
 * also protects the configured main and develop branch names.
 */
export function getProtectedBranches(
  gitflowStatus: GitflowStatus | null,
): Set<string> {
  const protected_ = new Set(["main", "master", "develop"]);

  if (gitflowStatus?.context?.isInitialized) {
    protected_.add("development");
    protected_.add("dev");
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
