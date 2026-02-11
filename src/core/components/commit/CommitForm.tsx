import { Loader2, Maximize2, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { commands } from "../../../bindings";
import { cn } from "../../lib/utils";
import { useCommitExecution } from "../../hooks/useCommitExecution";
import { useAmendPrefill } from "../../../extensions/conventional-commits/hooks/useAmendPrefill";
import { useBladeNavigation } from "../../hooks/useBladeNavigation";
import { useExtensionHost } from "../../../extensions";
import { ShortcutTooltip } from "../ui/ShortcutTooltip";
import { Button } from "../ui/button";
import { ConventionalCommitForm } from "../../../extensions/conventional-commits/components/ConventionalCommitForm";

export function CommitForm() {
  const [useConventional, setUseConventional] = useState(false);
  const [message, setMessage] = useState("");
  const { bladeStack, openBlade } = useBladeNavigation();
  const isCCActive = useExtensionHost(
    (s) => s.extensions.get("conventional-commits")?.status === "active"
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

  // Listen for toggle-amend event from keyboard shortcut
  useEffect(() => {
    const handleToggleAmend = () => {
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
  }, [amendPrefill, message]);

  // Auto-reset conventional commit mode when extension is disabled
  useEffect(() => {
    if (!isCCActive && useConventional) {
      setUseConventional(false);
    }
  }, [isCCActive, useConventional]);

  const { data: result } = useQuery({
    queryKey: ["stagingStatus"],
    queryFn: () => commands.getStagingStatus(),
  });

  const status = result?.status === "ok" ? result.data : null;
  const hasStagedFiles = status && status.staged.length > 0;

  // Handle commit from ConventionalCommitForm
  const handleConventionalCommit = (commitMessage: string) => {
    commit(commitMessage, false);
  };

  // Simple form logic
  const canSimpleCommit = hasStagedFiles && message.trim().length > 0;
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
            disabled={isCommitting || !hasStagedFiles}
          />
          {!hasStagedFiles && (
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
                shortcut="mod+shift+M"
                label="Toggle Amend"
                side="top"
              >
                <label className="flex items-center gap-1.5 text-ctp-overlay1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={amendPrefill.amend}
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
            onClick={() => {
              if (amendPrefill.amend) {
                const confirmed = window.confirm(
                  "Amend will rewrite the last commit. This cannot be undone. Continue?",
                );
                if (!confirmed) return;
              }
              commit(message, amendPrefill.amend);
            }}
            disabled={!canSimpleCommit || isCommitting}
            className="w-full"
          >
            {isCommitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Committing...
              </>
            ) : amendPrefill.amend ? (
              <>
                <RotateCcw className="w-4 h-4 mr-2" />
                Amend Commit
              </>
            ) : (
              "Commit"
            )}
          </Button>

          {!hasStagedFiles && (
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
