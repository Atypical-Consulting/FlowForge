import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw } from "lucide-react";
import { useState } from "react";
import { commands } from "../../bindings";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

export function CommitForm() {
  const [message, setMessage] = useState("");
  const [amend, setAmend] = useState(false);
  const queryClient = useQueryClient();

  const { data: result } = useQuery({
    queryKey: ["stagingStatus"],
    queryFn: () => commands.getStagingStatus(),
  });

  const commitMutation = useMutation({
    mutationFn: () => commands.createCommit(message, amend),
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
  const canCommit = hasStagedFiles && message.trim().length > 0;

  // Parse subject line for character count
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
    <div className="border-t border-gray-800 p-3 bg-gray-950">
      <div className="space-y-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Commit message..."
          className={cn(
            "w-full h-24 px-3 py-2 text-sm bg-gray-900 border border-gray-700",
            "rounded resize-none focus:outline-none focus:border-blue-500",
            "text-gray-200 placeholder:text-gray-500"
          )}
        />

        {/* Character count and guidance */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-gray-400">
              <input
                type="checkbox"
                checked={amend}
                onChange={(e) => setAmend(e.target.checked)}
                className="rounded border-gray-600"
              />
              Amend last commit
            </label>
          </div>

          <span
            className={cn(
              "font-mono",
              subjectStatus === "good" && "text-green-500",
              subjectStatus === "warning" && "text-yellow-500",
              subjectStatus === "error" && "text-red-500",
              subjectStatus === "empty" && "text-gray-500"
            )}
          >
            {subjectLength}/50
            {subjectStatus === "warning" && " (suggested max)"}
            {subjectStatus === "error" && " (too long)"}
          </span>
        </div>

        {/* Commit button */}
        <Button
          onClick={() => commitMutation.mutate()}
          disabled={!canCommit || commitMutation.isPending}
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
          <p className="text-xs text-gray-500 text-center">
            No staged changes to commit
          </p>
        )}

        {commitMutation.isError && (
          <p className="text-xs text-red-400 text-center">
            {String(commitMutation.error)}
          </p>
        )}
      </div>
    </div>
  );
}
