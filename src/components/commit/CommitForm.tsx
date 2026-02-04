import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw } from "lucide-react";
import { useState } from "react";
import { commands } from "../../bindings";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { ConventionalCommitForm } from "./ConventionalCommitForm";

export function CommitForm() {
  const [useConventional, setUseConventional] = useState(true);
  const [message, setMessage] = useState("");
  const [amend, setAmend] = useState(false);
  const queryClient = useQueryClient();

  const { data: result } = useQuery({
    queryKey: ["stagingStatus"],
    queryFn: () => commands.getStagingStatus(),
  });

  const commitMutation = useMutation({
    mutationFn: (commitMessage: string) =>
      commands.createCommit(commitMessage, amend),
    onSuccess: () => {
      setMessage("");
      setAmend(false);
      queryClient.invalidateQueries({ queryKey: ["stagingStatus"] });
      queryClient.invalidateQueries({ queryKey: ["commitHistory"] });
      queryClient.invalidateQueries({ queryKey: ["repositoryStatus"] });
    },
  });

  const status = result?.status === "ok" ? result.data : null;
  const hasStagedFiles = status && status.staged.length > 0;

  // Handle commit from ConventionalCommitForm
  const handleConventionalCommit = (commitMessage: string) => {
    commitMutation.mutate(commitMessage);
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
        <label className="flex items-center gap-2 text-xs text-ctp-overlay1 cursor-pointer">
          <input
            type="checkbox"
            checked={useConventional}
            onChange={(e) => setUseConventional(e.target.checked)}
            className="rounded border-ctp-surface2 bg-ctp-surface0 text-ctp-blue focus:ring-ctp-blue"
          />
          Conventional Commits
        </label>
      </div>

      {/* Conventional commit form */}
      {useConventional ? (
        <div className="space-y-3">
          <ConventionalCommitForm
            onCommit={handleConventionalCommit}
            disabled={commitMutation.isPending || !hasStagedFiles}
          />
          {!hasStagedFiles && (
            <p className="text-xs text-ctp-overlay0 text-center">
              No staged changes to commit
            </p>
          )}
          {commitMutation.isError && (
            <p className="text-xs text-ctp-red text-center">
              {String(commitMutation.error)}
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
              <label className="flex items-center gap-1.5 text-ctp-overlay1">
                <input
                  type="checkbox"
                  checked={amend}
                  onChange={(e) => setAmend(e.target.checked)}
                  className="rounded border-ctp-surface2"
                />
                Amend last commit
              </label>
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
            onClick={() => commitMutation.mutate(message)}
            disabled={!canSimpleCommit || commitMutation.isPending}
            className="w-full"
          >
            {commitMutation.isPending ? (
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

          {!hasStagedFiles && (
            <p className="text-xs text-ctp-overlay0 text-center">
              No staged changes to commit
            </p>
          )}

          {commitMutation.isError && (
            <p className="text-xs text-ctp-red text-center">
              {String(commitMutation.error)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
