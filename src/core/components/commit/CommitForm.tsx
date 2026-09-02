import { useQuery } from "@tanstack/react-query";
import { GitMerge, Loader2, Maximize2, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useCommandShortcut } from "@/framework/command-palette/useCommandShortcut";
import { confirm } from "@/framework/stores/confirm";
import { commands, type RepoStatus } from "../../../bindings";
import { useExtensionHost } from "../../../extensions";
import { ConventionalCommitForm } from "../../../extensions/conventional-commits/components/ConventionalCommitForm";
import { useAmendPrefill } from "../../../extensions/conventional-commits/hooks/useAmendPrefill";
import { useBladeNavigation } from "../../hooks/useBladeNavigation";
import { useCommitExecution } from "../../hooks/useCommitExecution";
import { cn } from "../../lib/utils";
import { useGitOpsStore } from "../../stores/domain/git-ops";
import { Button } from "../ui/button";
import { ShortcutTooltip } from "../ui/ShortcutTooltip";

/**
 * Merge-state fields of `RepoStatus` returned by `get_repository_status`.
 *
 * Declared locally (and intersected with the generated type) so this file
 * compiles whether or not `src/bindings.ts` has been regenerated with them;
 * once it has, this can be dropped in favour of `RepoStatus` alone.
 */
interface MergeStateFields {
  mergeInProgress?: boolean;
  mergeHeadBranch?: string | null;
  mergeMessage?: string | null;
}

export function CommitForm() {
  const [useConventional, setUseConventional] = useState(false);
  const [message, setMessage] = useState("");
  const { bladeStack, openBlade } = useBladeNavigation();
  const repoStatus = useGitOpsStore((s) => s.repoStatus) as
    | (RepoStatus & MergeStateFields)
    | null;
  const mergeInProgress = repoStatus?.mergeInProgress ?? false;
  const mergeHeadBranch = repoStatus?.mergeHeadBranch ?? null;
  const mergeMessage = repoStatus?.mergeMessage ?? null;
  const isCCActive = useExtensionHost(
    (s) => s.extensions.get("conventional-commits")?.status === "active",
  );
  const isCCBladeOpen = bladeStack.some(
    (b) => b.type === "conventional-commit",
  );

  const { commit, isCommitting, commitError } = useCommitExecution({
    onCommitSuccess: () => {
      setMessage("");
      amendPrefill.setAmend(false);
    },
  });

  const amendPrefill = useAmendPrefill({ mode: "simple" });
  const amendShortcut = useCommandShortcut("ext:sync:toggle-amend");
  // Amending the pre-merge HEAD during a merge would silently drop the merge
  // (the backend refuses it too), so amend is forced off while merging.
  const amend = amendPrefill.amend && !mergeInProgress;

  // Listen for toggle-amend event from keyboard shortcut
  useEffect(() => {
    const handleToggleAmend = () => {
      if (mergeInProgress) return;
      amendPrefill.toggleAmend(!amendPrefill.amend, {
        onPrefill: (msg) => setMessage(msg),
        onClear: () => setMessage(""),
        hasContent: message.trim().length > 0,
      });
    };
    document.addEventListener("toggle-amend", handleToggleAmend);
    return () => {
      document.removeEventListener("toggle-amend", handleToggleAmend);
    };
  }, [amendPrefill, message, mergeInProgress]);

  // Auto-reset conventional commit mode when extension is disabled
  useEffect(() => {
    if (!isCCActive && useConventional) {
      setUseConventional(false);
    }
  }, [isCCActive, useConventional]);

  // Pre-fill the message git prepared in MERGE_MSG once per merge, and only
  // into an empty field so a message the user is typing is never replaced.
  const prefilledMergeMessage = useRef<string | null>(null);
  useEffect(() => {
    if (!mergeInProgress) {
      prefilledMergeMessage.current = null;
      return;
    }
    if (
      mergeMessage &&
      prefilledMergeMessage.current !== mergeMessage &&
      message.trim().length === 0
    ) {
      prefilledMergeMessage.current = mergeMessage;
      setMessage(mergeMessage);
    }
  }, [mergeInProgress, mergeMessage, message]);

  const { data: result } = useQuery({
    queryKey: ["stagingStatus"],
    queryFn: () => commands.getStagingStatus(),
  });

  const status = result?.status === "ok" ? result.data : null;
  const hasStagedFiles = status && status.staged.length > 0;
  // A merge commit is valid even when the resolved tree matches HEAD.
  const hasCommittableChanges = hasStagedFiles || mergeInProgress;

  // Handle commit from ConventionalCommitForm
  const handleConventionalCommit = (commitMessage: string) => {
    commit(commitMessage, false);
  };

  // Simple form logic
  const canSimpleCommit =
    (hasCommittableChanges || amend) && message.trim().length > 0;
  const lines = message.split("\n");
  const subject = lines[0] || "";
  const subjectLength = subject.length;

  const subjectStatus =
    subjectLength === 0
      ? "empty"
      : subjectLength <= 50
        ? "good"
        : subjectLength <= 72
          ? "warning"
          : "error";

  return (
    <div className="border-t border-ctp-surface0 p-3 bg-ctp-crust">
      {/* Mode toggle */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-ctp-subtext1">Commit</span>
        {isCCActive && (
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-ctp-overlay1 cursor-pointer">
              <input
                type="checkbox"
                checked={useConventional}
                onChange={(e) => setUseConventional(e.target.checked)}
                className="rounded border-ctp-surface2 bg-ctp-surface0 text-ctp-blue focus:ring-ctp-blue"
              />
              Conventional Commits
            </label>
            {useConventional && !isCCBladeOpen && (
              <button
                type="button"
                onClick={() =>
                  openBlade("conventional-commit", {}, "Conventional Commit")
                }
                className="p-1 text-ctp-overlay1 hover:text-ctp-blue rounded"
                title="Open in full-width blade"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {mergeInProgress && (
        <p
          role="status"
          className="flex items-center gap-1.5 mb-2 text-xs text-ctp-peach"
        >
          <GitMerge className="w-3.5 h-3.5 shrink-0" />
          <span>
            Merging {mergeHeadBranch ? <b>{mergeHeadBranch}</b> : "MERGE_HEAD"}{" "}
            &mdash; this commit will complete the merge
          </span>
        </p>
      )}

      {/* Conventional commit mode */}
      {useConventional && isCCBladeOpen ? (
        /* Placeholder when blade is open */
        <div className="flex flex-col items-center gap-2 py-6 text-ctp-overlay1">
          <span className="text-sm">Editing in blade view</span>
        </div>
      ) : useConventional ? (
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          <ConventionalCommitForm
            onCommit={handleConventionalCommit}
            onCancel={() => setUseConventional(false)}
            disabled={isCommitting || !hasCommittableChanges}
          />
          {!hasCommittableChanges && (
            <p className="text-xs text-ctp-overlay0 text-center">
              No staged changes to commit
            </p>
          )}
          {commitError && (
            <p className="text-xs text-ctp-red text-center">
              {String(commitError)}
            </p>
          )}
        </div>
      ) : (
        /* Simple commit form */
        <div className="space-y-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Commit message..."
            className={cn(
              "w-full h-24 px-3 py-2 text-sm bg-ctp-mantle border border-ctp-surface1",
              "rounded resize-none focus:outline-none focus:border-ctp-blue",
              "text-ctp-text placeholder:text-ctp-overlay0",
            )}
          />

          {/* Character count and guidance */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <ShortcutTooltip
                shortcut={amendShortcut}
                label={
                  mergeInProgress
                    ? "Amend is unavailable during a merge"
                    : "Toggle Amend"
                }
                side="top"
              >
                <label
                  className={cn(
                    "flex items-center gap-1.5 text-ctp-overlay1",
                    mergeInProgress
                      ? "opacity-50 cursor-not-allowed"
                      : "cursor-pointer",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={amend}
                    disabled={mergeInProgress}
                    aria-label="Amend last commit"
                    onChange={(e) =>
                      amendPrefill.toggleAmend(e.target.checked, {
                        onPrefill: (msg) => setMessage(msg),
                        onClear: () => setMessage(""),
                        hasContent: message.trim().length > 0,
                      })
                    }
                    className="rounded border-ctp-surface2"
                  />
                  <span className="text-xs">Amend last commit</span>
                </label>
              </ShortcutTooltip>
            </div>

            <span
              className={cn(
                "font-mono",
                subjectStatus === "good" && "text-ctp-green",
                subjectStatus === "warning" && "text-ctp-yellow",
                subjectStatus === "error" && "text-ctp-red",
                subjectStatus === "empty" && "text-ctp-overlay0",
              )}
            >
              {subjectLength}/50
              {subjectStatus === "warning" && " (suggested max)"}
              {subjectStatus === "error" && " (too long)"}
            </span>
          </div>

          {/* Commit button */}
          <Button
            onClick={async () => {
              if (amend) {
                const confirmed = await confirm({
                  title: "Amend commit",
                  description:
                    "Amend will rewrite the last commit. This cannot be undone. Continue?",
                  confirmLabel: "Amend",
                });
                if (!confirmed) return;
              }
              commit(message, amend);
            }}
            disabled={!canSimpleCommit || isCommitting}
            className="w-full"
          >
            {isCommitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Committing...
              </>
            ) : amend ? (
              <>
                <RotateCcw className="w-4 h-4 mr-2" />
                Amend Commit
              </>
            ) : (
              "Commit"
            )}
          </Button>

          {!hasCommittableChanges && !amend && (
            <p className="text-xs text-ctp-overlay0 text-center">
              No staged changes to commit
            </p>
          )}

          {commitError && (
            <p className="text-xs text-ctp-red text-center">
              {String(commitError)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
