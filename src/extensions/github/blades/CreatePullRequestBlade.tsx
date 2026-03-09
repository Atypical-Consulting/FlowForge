import { GitPullRequestCreate } from "lucide-react";
import { useEffect, useState } from "react";
import { commands } from "../../../bindings";
import { Button } from "../../../core/components/ui/button";
import { useGitOpsStore as useRepositoryStore } from "../../../core/stores/domain/git-ops";
import { ToggleSwitch } from "../components/ToggleSwitch";
import { useCreatePullRequest } from "../hooks/useGitHubMutation";

interface CreatePullRequestBladeProps {
  owner: string;
  repo: string;
}

/**
 * Strip common branch prefixes and convert to a human-readable title.
 */
function branchToTitle(branch: string): string {
  const stripped = branch
    .replace(/^(feature|fix|hotfix|bugfix|release|chore)\//, "")
    .replace(/[-_]/g, " ");
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

export function CreatePullRequestBlade({
  owner,
  repo,
}: CreatePullRequestBladeProps) {
  const currentBranch = useRepositoryStore(
    (s) => s.repoStatus?.branchName ?? "",
  );

  const [title, setTitle] = useState("");
  const [base, setBase] = useState("main");
  const [body, setBody] = useState("");
  const [isDraft, setIsDraft] = useState(false);
  const [isLoadingInfo, setIsLoadingInfo] = useState(true);

  const mutation = useCreatePullRequest(owner, repo);

  // Auto-fill from branch info on mount
  useEffect(() => {
    let cancelled = false;

    async function loadBranchInfo() {
      try {
        const result = await commands.githubGetBranchInfoForPr();
        if (cancelled) return;
        if (result.status === "ok") {
          setTitle(result.data.suggestedTitle);
          setBase(result.data.defaultBase);
          if (result.data.commitMessages.length > 0) {
            setBody(result.data.commitMessages.map((m) => `- ${m}`).join("\n"));
          }
        }
      } catch {
        // Fallback to branch name parsing
        if (!cancelled && currentBranch) {
          setTitle(branchToTitle(currentBranch));
        }
      } finally {
        if (!cancelled) setIsLoadingInfo(false);
      }
    }

    loadBranchInfo();
    return () => {
      cancelled = true;
    };
  }, [currentBranch]);

  const isSameBranch = currentBranch === base;
  const canSubmit =
    title.trim().length > 0 && !isSameBranch && !mutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    mutation.mutate({
      title: title.trim(),
      head: currentBranch,
      base,
      body: body.trim() || undefined,
      draft: isDraft || undefined,
    });
  };

  return (
    <div className="h-full overflow-y-auto">
      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
        {/* Branch info bar */}
        <div className="flex items-center gap-2 text-xs text-ctp-overlay0">
          <GitPullRequestCreate className="w-4 h-4 text-ctp-green" />
          <span className="font-mono bg-ctp-surface0 px-1.5 py-0.5 rounded text-ctp-subtext1">
            {currentBranch || "..."}
          </span>
          <span>&rarr;</span>
          <input
            type="text"
            value={base}
            onChange={(e) => setBase(e.target.value)}
            className="font-mono bg-ctp-mantle border border-ctp-surface1 rounded px-1.5 py-0.5 text-xs text-ctp-subtext1 w-24 focus:outline-none focus:border-ctp-blue"
            placeholder="main"
          />
        </div>

        {/* Same branch warning */}
        {isSameBranch && (
          <p className="text-xs text-ctp-yellow">
            Cannot create a PR from the same branch.
          </p>
        )}

        {/* Title */}
        <div>
          <label
            htmlFor="pr-title"
            className="block text-xs font-medium text-ctp-subtext1 mb-1"
          >
            Title
          </label>
          <input
            id="pr-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            disabled={isLoadingInfo}
            className="w-full bg-ctp-mantle border border-ctp-surface1 rounded px-3 py-2 text-sm text-ctp-text placeholder:text-ctp-overlay0 focus:outline-none focus:border-ctp-blue"
            placeholder="Pull request title"
          />
        </div>

        {/* Description */}
        <div>
          <label
            htmlFor="pr-body"
            className="block text-xs font-medium text-ctp-subtext1 mb-1"
          >
            Description
          </label>
          <textarea
            id="pr-body"
            rows={8}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={isLoadingInfo}
            className="w-full bg-ctp-mantle border border-ctp-surface1 rounded px-3 py-2 text-sm text-ctp-text font-mono placeholder:text-ctp-overlay0 focus:outline-none focus:border-ctp-blue resize-none"
            placeholder="Describe your changes..."
          />
        </div>

        {/* Draft toggle */}
        <div className="flex items-center gap-2">
          <ToggleSwitch
            checked={isDraft}
            onChange={setIsDraft}
            aria-label="Create as draft"
          />
          <span className="text-xs text-ctp-subtext0">Create as draft</span>
        </div>

        {/* Submit button */}
        <Button
          type="submit"
          disabled={!canSubmit}
          loading={mutation.isPending}
          loadingText="Creating..."
          className="w-full"
        >
          <GitPullRequestCreate className="w-4 h-4 mr-1.5" />
          Create Pull Request
        </Button>
      </form>
    </div>
  );
}
