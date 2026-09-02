import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ok } from "../../../core/test-utils/mocks/tauri-commands";

const mockCommands = vi.hoisted(() => ({
  listConflictFiles: vi.fn(),
  getConflictContent: vi.fn(),
  resolveConflictFile: vi.fn(),
}));

vi.mock("../../../bindings", () => ({ commands: mockCommands }));

import {
  CONFLICT_FILES_QUERY_KEY,
  CONFLICT_POLL_INTERVAL_MS,
  shouldPollConflictFiles,
  useConflictFiles,
} from "../hooks/useConflictQuery";
import { useConflictStore } from "../store";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

describe("shouldPollConflictFiles", () => {
  it("does not poll when there are no conflicts and no merge in progress", () => {
    expect(shouldPollConflictFiles([], false)).toBe(false);
    expect(shouldPollConflictFiles(undefined, false)).toBe(false);
  });

  it("polls while conflicts exist", () => {
    expect(shouldPollConflictFiles(["README.md"], false)).toBe(true);
  });

  it("polls while a merge is in progress even before conflicts are listed", () => {
    expect(shouldPollConflictFiles([], true)).toBe(true);
    expect(shouldPollConflictFiles(undefined, true)).toBe(true);
  });
});

describe("useConflictFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves with the path list (never undefined) and fills the store", async () => {
    mockCommands.listConflictFiles.mockResolvedValue(ok(["README.md"]));
    const { wrapper, queryClient } = createWrapper();

    const { result } = renderHook(() => useConflictFiles(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(["README.md"]);
    expect(result.current.isError).toBe(false);
    expect(queryClient.getQueryData(CONFLICT_FILES_QUERY_KEY)).toEqual([
      "README.md",
    ]);
    expect(useConflictStore.getState().files.has("README.md")).toBe(true);
  });

  it("resolves with an empty array when the repo has no conflicts", async () => {
    mockCommands.listConflictFiles.mockResolvedValue(ok([]));
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useConflictFiles(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
    expect(result.current.data).not.toBeUndefined();
  });

  it("stops polling once the list is empty and no merge is in progress", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockCommands.listConflictFiles.mockResolvedValue(ok([]));
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useConflictFiles(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockCommands.listConflictFiles).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONFLICT_POLL_INTERVAL_MS * 2 + 100);
    });

    expect(mockCommands.listConflictFiles).toHaveBeenCalledTimes(1);
  });

  it("keeps polling while conflicts are present", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockCommands.listConflictFiles.mockResolvedValue(ok(["README.md"]));
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useConflictFiles(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockCommands.listConflictFiles).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CONFLICT_POLL_INTERVAL_MS + 100);
    });

    expect(mockCommands.listConflictFiles.mock.calls.length).toBeGreaterThan(1);
  });
});
