import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Channel } from "@tauri-apps/api/core";
import { gitHookBus } from "@/core/services/gitHookBus";
import { toast } from "@/framework/stores/toast";
import { commands, type SyncProgress } from "../../bindings";
import { getErrorMessage } from "../lib/errors";

interface UseCommitExecutionOptions {
  onCommitSuccess?: (message: string) => void;
  onPushSuccess?: () => void;
  onPushError?: (error: unknown) => void;
}

/**
 * Reusable hook for commit and push mutations.
 *
 * Extracted from CommitForm.tsx to be shared between sidebar and blade.
 */
export function useCommitExecution(options?: UseCommitExecutionOptions) {
  const queryClient = useQueryClient();

  const pushMutation = useMutation({
    mutationFn: () => {
      const channel = new Channel<SyncProgress>();
      return commands.pushToRemote("origin", channel);
    },
    onSuccess: (result) => {
      if (result.status === "error") {
        toast.error(`Push failed: ${getErrorMessage(result.error)}`);
        options?.onPushError?.(result.error);
        return;
      }
      if (!result.data.success) {
        toast.error(`Push failed: ${result.data.message}`);
        options?.onPushError?.(new Error(result.data.message));
        return;
      }
      toast.success("Pushed to origin");
      queryClient.invalidateQueries({ queryKey: ["commitHistory"] });
      gitHookBus.emitDid("push");
      options?.onPushSuccess?.();
    },
    onError: (error) => {
      toast.error(`Push failed: ${String(error)}`, {
        label: "Retry",
        onClick: () => pushMutation.mutate(),
      });
      options?.onPushError?.(error);
    },
  });

  const commitMutation = useMutation({
    mutationFn: ({ message, amend }: { message: string; amend: boolean }) =>
      commands.createCommit(message, amend),
    onSuccess: (_data, { message: commitMessage }) => {
      queryClient.invalidateQueries({ queryKey: ["stagingStatus"] });
      queryClient.invalidateQueries({ queryKey: ["commitHistory"] });
      queryClient.invalidateQueries({ queryKey: ["repositoryStatus"] });
      gitHookBus.emitDid("commit", { commitMessage });

      const shortMessage =
        commitMessage.length > 50
          ? `${commitMessage.slice(0, 50)}...`
          : commitMessage;
      toast.success(`Committed: ${shortMessage}`, {
        label: "Push now",
        onClick: () => pushMutation.mutate(),
      });
      options?.onCommitSuccess?.(commitMessage);
    },
    onError: (error) => {
      toast.error(`Commit failed: ${String(error)}`);
    },
  });

  const commit = async (message: string, amend = false) => {
    const willResult = await gitHookBus.emitWill("commit", {
      commitMessage: message,
    });
    if (willResult.cancel) {
      toast.warning(willResult.reason ?? "Commit cancelled by extension");
      return;
    }
    // Errors are surfaced via commitMutation.onError; swallow the rejection
    // here so callers (fire-and-forget) don't trigger unhandled rejections.
    try {
      await commitMutation.mutateAsync({ message, amend });
    } catch {
      /* surfaced by onError toast */
    }
  };

  const commitAndPush = async (message: string, amend = false) => {
    const willResult = await gitHookBus.emitWill("commit", {
      commitMessage: message,
    });
    if (willResult.cancel) {
      toast.warning(willResult.reason ?? "Commit cancelled by extension");
      return;
    }
    // Errors are surfaced via mutation onError handlers; swallow the rejections
    // so fire-and-forget callers don't trigger unhandled rejections. If the
    // commit fails, do not attempt to push.
    try {
      await commitMutation.mutateAsync({ message, amend });
    } catch {
      /* surfaced by onError toast */
      return;
    }
    try {
      await pushMutation.mutateAsync();
    } catch {
      /* surfaced by onError toast */
    }
  };

  const push = async () => {
    try {
      await pushMutation.mutateAsync();
    } catch {
      /* surfaced by onError toast */
    }
  };

  return {
    commit,
    commitAndPush,
    push,
    isCommitting: commitMutation.isPending,
    isPushing: pushMutation.isPending,
    isBusy: commitMutation.isPending || pushMutation.isPending,
    commitError: commitMutation.error,
    pushError: pushMutation.error,
  };
}
