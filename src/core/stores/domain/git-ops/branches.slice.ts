import type { StateCreator } from "zustand";
import { gitHookBus } from "@/core/services/gitHookBus";
import type { BranchInfo, GitError } from "../../../../bindings";
import { commands } from "../../../../bindings";
import { getErrorMessage } from "../../../lib/errors";
import type { GitOpsStore } from "./index";
import type { GitOpsMiddleware } from "./types";

// Merge workflow moved to src/machines/merge/

export interface BranchSlice {
  branchList: BranchInfo[];
  branchAllList: BranchInfo[];
  branchIsLoading: boolean;
  /**
   * Last error of any branch operation, shown as the branch panel banner.
   * Reset whenever a list reload starts.
   */
  branchError: string | null;
  /**
   * Last error of a branch *mutation* (create / checkout / delete). Unlike
   * `branchError` it survives list reloads (`loadBranches`,
   * `loadAllBranches`), which the file watcher and other panels trigger at
   * any time: a dialog that just failed must keep showing why until the user
   * edits the form, retries or dismisses it.
   */
  branchMutationError: string | null;

  loadBranches: () => Promise<void>;
  loadAllBranches: (includeRemote: boolean) => Promise<void>;
  /** Reload both branch lists (sidebar + header/count) after a mutation. */
  reloadBranchLists: () => Promise<void>;
  createBranch: (name: string, checkout: boolean) => Promise<BranchInfo | null>;
  checkoutBranch: (name: string) => Promise<boolean>;
  checkoutRemoteBranch: (remoteBranch: string) => Promise<boolean>;
  deleteBranch: (name: string, force: boolean) => Promise<boolean>;
  /** Clear both the panel banner and the mutation error. */
  clearBranchError: () => void;
  /** Clear only the mutation error (dialog dismissed or form edited). */
  clearBranchMutationError: () => void;
}

export const createBranchSlice: StateCreator<
  GitOpsStore,
  GitOpsMiddleware,
  [],
  BranchSlice
> = (set, get) => {
  const startMutation = (action: string) =>
    set(
      { branchIsLoading: true, branchError: null, branchMutationError: null },
      undefined,
      action,
    );

  const failMutation = (action: string, error: GitError) => {
    const message = getErrorMessage(error);
    set(
      {
        branchError: message,
        branchMutationError: message,
        branchIsLoading: false,
      },
      undefined,
      action,
    );
  };

  return {
    branchList: [],
    branchAllList: [],
    branchIsLoading: false,
    branchError: null,
    branchMutationError: null,

    loadBranches: async () => {
      set(
        { branchIsLoading: true, branchError: null },
        undefined,
        "gitOps:branch/load",
      );
      const result = await commands.listBranches();
      if (result.status === "ok") {
        set(
          { branchList: result.data, branchIsLoading: false },
          undefined,
          "gitOps:branch/loadOk",
        );
      } else {
        set({
          branchError: getErrorMessage(result.error),
          branchIsLoading: false,
        });
      }
    },

    loadAllBranches: async (includeRemote: boolean) => {
      set(
        { branchIsLoading: true, branchError: null },
        undefined,
        "gitOps:branch/loadAll",
      );
      const result = await commands.listAllBranches(includeRemote);
      if (result.status === "ok") {
        set(
          { branchAllList: result.data, branchIsLoading: false },
          undefined,
          "gitOps:branch/loadAllOk",
        );
      } else {
        set({
          branchError: getErrorMessage(result.error),
          branchIsLoading: false,
        });
      }
    },

    reloadBranchLists: async () => {
      await Promise.all([get().loadBranches(), get().loadAllBranches(true)]);
    },

    createBranch: async (name, checkout) => {
      startMutation("gitOps:branch/create");
      const result = await commands.createBranch(name, checkout);
      if (result.status === "ok") {
        await Promise.all([
          get().reloadBranchLists(),
          checkout ? get().refreshRepoStatus() : Promise.resolve(),
        ]);
        gitHookBus.emitDid("branch-create", { branchName: name });
        return result.data;
      }
      failMutation("gitOps:branch/createFailed", result.error);
      return null;
    },

    checkoutBranch: async (name) => {
      startMutation("gitOps:branch/checkout");
      const result = await commands.checkoutBranch(name);
      if (result.status === "ok") {
        // HEAD moved: refresh both the branch list and the repository status so
        // the toolbar branch indicator follows the checkout.
        await Promise.all([
          get().reloadBranchLists(),
          get().refreshRepoStatus(),
        ]);
        gitHookBus.emitDid("checkout", { branchName: name });
        return true;
      }
      failMutation("gitOps:branch/checkoutFailed", result.error);
      return false;
    },

    checkoutRemoteBranch: async (remoteBranch: string) => {
      startMutation("gitOps:branch/checkoutRemote");
      const result = await commands.checkoutRemoteBranch(remoteBranch);
      if (result.status === "ok") {
        await Promise.all([
          get().reloadBranchLists(),
          get().refreshRepoStatus(),
        ]);
        gitHookBus.emitDid("checkout", { branchName: remoteBranch });
        return true;
      }
      failMutation("gitOps:branch/checkoutRemoteFailed", result.error);
      return false;
    },

    deleteBranch: async (name, force) => {
      startMutation("gitOps:branch/delete");
      const result = await commands.deleteBranch(name, force);
      if (result.status === "ok") {
        await get().reloadBranchLists();
        gitHookBus.emitDid("branch-delete", { branchName: name });
        return true;
      }
      failMutation("gitOps:branch/deleteFailed", result.error);
      return false;
    },

    clearBranchError: () =>
      set(
        { branchError: null, branchMutationError: null },
        undefined,
        "gitOps:branch/clearError",
      ),

    clearBranchMutationError: () =>
      set(
        { branchMutationError: null },
        undefined,
        "gitOps:branch/clearMutationError",
      ),
  };
};

/**
 * Live current-branch name, shared by the toolbar branch indicator and the
 * sidebar. Prefers the HEAD entry of the loaded branch list (refreshed after
 * every checkout / gitflow operation / watcher event) and falls back to the
 * repository status (initial open, detached HEAD short hash, or no list yet).
 */
export function selectCurrentBranchName(
  state: Pick<GitOpsStore, "branchList" | "repoStatus">,
): string {
  return (
    state.branchList.find((b) => b.isHead)?.name ??
    state.repoStatus?.branchName ??
    ""
  );
}
