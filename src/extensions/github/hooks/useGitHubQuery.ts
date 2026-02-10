/**
 * TanStack Query hooks for GitHub PR and issue data.
 *
 * All query keys use the "ext:github" prefix for cache isolation,
 * ensuring GitHub data does not collide with core app queries.
 * Hooks follow the established Tauri command result pattern:
 * check result.status, throw on error for TanStack Query to handle.
 *
 * staleTime: 2 minutes for lists, 1 minute for details.
 * Lists use useInfiniteQuery for cursor-based pagination.
 * Details use useQuery for single resource fetching.
 */

import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { commands } from "../../../bindings";

const PER_PAGE = 30;

/**
 * Extract a human-readable error message from a GitHubError.
 */
function extractErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    if ("message" in error && typeof (error as Record<string, unknown>).message === "string") {
      return (error as Record<string, string>).message;
    }
    if ("type" in error && typeof (error as Record<string, unknown>).type === "string") {
      return (error as Record<string, string>).type;
    }
  }
  return "Unknown GitHub error";
}

/**
 * Fetch a paginated list of pull requests for a repository.
 *
 * Uses useInfiniteQuery with page-based pagination.
 * getNextPageParam reads hasNextPage/nextPage from the response.
 */
export function usePullRequestList(
  owner: string,
  repo: string,
  state: "open" | "closed" | "all" = "open",
) {
  return useInfiniteQuery({
    queryKey: ["ext:github", "pullRequests", owner, repo, state],
    queryFn: async ({ pageParam }) => {
      const result = await commands.githubListPullRequests(
        owner,
        repo,
        state,
        pageParam,
        PER_PAGE,
      );
      if (result.status === "error") {
        throw new Error(extractErrorMessage(result.error));
      }
      return result.data;
    },
    getNextPageParam: (lastPage) =>
      lastPage.hasNextPage ? lastPage.nextPage : undefined,
    initialPageParam: 1,
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!owner && !!repo,
  });
}

/**
 * Fetch detailed pull request information including comments.
 */
export function usePullRequestDetail(
  owner: string,
  repo: string,
  number: number,
) {
  return useQuery({
    queryKey: ["ext:github", "pullRequest", owner, repo, number],
    queryFn: async () => {
      const result = await commands.githubGetPullRequest(owner, repo, number);
      if (result.status === "error") {
        throw new Error(extractErrorMessage(result.error));
      }
      return result.data;
    },
    staleTime: 60 * 1000, // 1 minute
    enabled: !!owner && !!repo && number > 0,
  });
}

/**
 * Fetch a paginated list of issues for a repository.
 *
 * The backend filters out pull requests (GitHub's issues endpoint
 * returns PRs too), so this returns only true issues.
 */
export function useIssueList(
  owner: string,
  repo: string,
  state: "open" | "closed" | "all" = "open",
) {
  return useInfiniteQuery({
    queryKey: ["ext:github", "issues", owner, repo, state],
    queryFn: async ({ pageParam }) => {
      const result = await commands.githubListIssues(
        owner,
        repo,
        state,
        pageParam,
        PER_PAGE,
      );
      if (result.status === "error") {
        throw new Error(extractErrorMessage(result.error));
      }
      return result.data;
    },
    getNextPageParam: (lastPage) =>
      lastPage.hasNextPage ? lastPage.nextPage : undefined,
    initialPageParam: 1,
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!owner && !!repo,
  });
}

/**
 * Fetch detailed issue information including comments.
 */
export function useIssueDetail(
  owner: string,
  repo: string,
  number: number,
) {
  return useQuery({
    queryKey: ["ext:github", "issue", owner, repo, number],
    queryFn: async () => {
      const result = await commands.githubGetIssue(owner, repo, number);
      if (result.status === "error") {
        throw new Error(extractErrorMessage(result.error));
      }
      return result.data;
    },
    staleTime: 60 * 1000, // 1 minute
    enabled: !!owner && !!repo && number > 0,
  });
}
