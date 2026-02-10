/**
 * TanStack Query mutation hooks for GitHub write operations.
 *
 * Follows the same error extraction pattern as useGitHubQuery.ts.
 * Query key prefixes use "ext:github" for cache isolation.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { commands } from "../../../bindings";
import { toast } from "../../../stores/toast";

/**
 * Extract a human-readable error message from a GitHubError or unknown error.
 */
function extractGitHubErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    if ("message" in error && typeof (error as Record<string, unknown>).message === "string") {
      return (error as Record<string, string>).message;
    }
    if ("type" in error && typeof (error as Record<string, unknown>).type === "string") {
      return (error as Record<string, string>).type;
    }
  }
  if (error instanceof Error) return error.message;
  return "Unknown GitHub error";
}

interface MergePullRequestParams {
  pullNumber: number;
  mergeMethod: "merge" | "squash" | "rebase";
  commitTitle?: string;
  commitMessage?: string;
  sha?: string;
}

/**
 * Mutation hook for merging a pull request.
 *
 * On success, invalidates both the PR detail and PR list queries.
 */
export function useMergePullRequest(owner: string, repo: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: MergePullRequestParams) => {
      const result = await commands.githubMergePullRequest(
        owner,
        repo,
        params.pullNumber,
        params.mergeMethod,
        params.commitTitle ?? null,
        params.commitMessage ?? null,
        params.sha ?? null,
      );
      if (result.status === "error") {
        throw new Error(extractGitHubErrorMessage(result.error));
      }
      return result.data;
    },
    onSuccess: (_data, variables) => {
      toast.success(`Pull request #${variables.pullNumber} merged`);
      queryClient.invalidateQueries({
        queryKey: ["ext:github", "pullRequest", owner, repo, variables.pullNumber],
      });
      queryClient.invalidateQueries({
        queryKey: ["ext:github", "pullRequests", owner, repo],
      });
    },
    onError: (error: Error) => {
      toast.error(`Merge failed: ${error.message}`);
    },
  });
}

interface CreatePullRequestParams {
  title: string;
  head: string;
  base: string;
  body?: string;
  draft?: boolean;
}

/**
 * Mutation hook for creating a new pull request.
 *
 * On success, invalidates the PR list query and shows the new PR number.
 */
export function useCreatePullRequest(owner: string, repo: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreatePullRequestParams) => {
      const result = await commands.githubCreatePullRequest(
        owner,
        repo,
        params.title,
        params.head,
        params.base,
        params.body ?? null,
        params.draft ?? null,
      );
      if (result.status === "error") {
        throw new Error(extractGitHubErrorMessage(result.error));
      }
      return result.data;
    },
    onSuccess: (data) => {
      toast.success(`Pull request #${data.number} created`);
      queryClient.invalidateQueries({
        queryKey: ["ext:github", "pullRequests", owner, repo],
      });
    },
    onError: (error: Error) => {
      toast.error(`Create PR failed: ${error.message}`);
    },
  });
}
