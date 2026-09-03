import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fakeStore = vi.hoisted(() => {
  const data = new Map<string, unknown>();
  return {
    data,
    get: vi.fn(async (key: string) => data.get(key)),
    set: vi.fn(async (key: string, value: unknown) => {
      data.set(key, value);
    }),
    save: vi.fn(async () => {}),
  };
});

vi.mock("@/framework/stores/persistence/tauri", () => ({
  getStore: async () => fakeStore,
}));

import { useRecentRepos } from "../useRecentRepos";

describe("useRecentRepos persistence", () => {
  beforeEach(() => {
    fakeStore.data.clear();
    vi.clearAllMocks();
  });

  it("flushes the store to disk after recording an open", async () => {
    const { result } = renderHook(() => useRecentRepos());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addRecentRepo("/tmp/repo-a", "repo-a");
    });

    // Regression: without save() the new timestamp only lived in memory and
    // was lost when the app closed, so the welcome list kept a stale order.
    expect(fakeStore.set).toHaveBeenCalledTimes(1);
    expect(fakeStore.save).toHaveBeenCalledTimes(1);
    const saved = fakeStore.data.get("recent-repositories") as Array<{
      path: string;
      lastOpened: number;
    }>;
    expect(saved[0].path).toBe("/tmp/repo-a");
    expect(saved[0].lastOpened).toBeGreaterThan(0);
  });

  it("moves a re-opened repository to the front with a fresh timestamp", async () => {
    fakeStore.data.set("recent-repositories", [
      { path: "/tmp/other", name: "other", lastOpened: 2 },
      { path: "/tmp/repo-a", name: "repo-a", lastOpened: 1 },
    ]);
    const { result } = renderHook(() => useRecentRepos());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addRecentRepo("/tmp/repo-a");
    });

    const saved = fakeStore.data.get("recent-repositories") as Array<{
      path: string;
      lastOpened: number;
    }>;
    expect(saved.map((r) => r.path)).toEqual(["/tmp/repo-a", "/tmp/other"]);
    expect(saved[0].lastOpened).toBeGreaterThan(2);
    expect(fakeStore.save).toHaveBeenCalled();
  });
});
