import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "../../../core/lib/queryClient";
import { ok } from "../../../core/test-utils/mocks/tauri-commands";
import type { ExtensionAPI } from "../../../framework/extension-system/ExtensionAPI";
import { useToolbarRegistry } from "../../../framework/extension-system/toolbarRegistry";

const mockCommands = vi.hoisted(() => ({
  listConflictFiles: vi.fn(),
  getConflictContent: vi.fn(),
  resolveConflictFile: vi.fn(),
}));

vi.mock("../../../bindings", () => ({ commands: mockCommands }));
vi.mock("@/framework/layout/bladeOpener", () => ({ openBlade: vi.fn() }));

import { CONFLICT_FILES_QUERY_KEY } from "../hooks/useConflictQuery";
import { onActivate, onDeactivate, refreshConflictFiles } from "../index";
import { useConflictStore } from "../store";

type DidHandler = () => void;

function createFakeApi() {
  const didHandlers = new Map<string, DidHandler[]>();
  const api = {
    registerBlade: vi.fn(),
    contributeToolbar: vi.fn(),
    registerCommand: vi.fn(),
    onDidGit: vi.fn((operation: string, handler: DidHandler) => {
      const list = didHandlers.get(operation) ?? [];
      list.push(handler);
      didHandlers.set(operation, list);
    }),
  };
  const fire = async (operation: string) => {
    for (const handler of didHandlers.get(operation) ?? []) {
      await handler();
    }
  };
  return { api: api as unknown as ExtensionAPI, fire, didHandlers };
}

describe("conflict-resolution extension activation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
    mockCommands.listConflictFiles.mockResolvedValue(ok([]));
    onDeactivate();
  });

  it("refreshes toolbar visibility whenever the conflict list changes", async () => {
    const { api } = createFakeApi();
    await onActivate(api);
    const tickBefore = useToolbarRegistry.getState().visibilityTick;

    mockCommands.listConflictFiles.mockResolvedValue(ok(["README.md"]));
    await act(async () => {
      await useConflictStore.getState().loadConflictFiles();
    });
    expect(useToolbarRegistry.getState().visibilityTick).toBe(tickBefore + 1);

    // Same list again: nothing changed, no spurious refresh
    await act(async () => {
      await useConflictStore.getState().loadConflictFiles();
    });
    expect(useToolbarRegistry.getState().visibilityTick).toBe(tickBefore + 1);

    // Conflicts gone (e.g. merge aborted from a terminal): badge must hide
    mockCommands.listConflictFiles.mockResolvedValue(ok([]));
    await act(async () => {
      await useConflictStore.getState().loadConflictFiles();
    });
    expect(useToolbarRegistry.getState().visibilityTick).toBe(tickBefore + 2);
    expect(useConflictStore.getState().conflictCount()).toBe(0);

    onDeactivate();
  });

  it("stops refreshing the toolbar after deactivation", async () => {
    const { api } = createFakeApi();
    await onActivate(api);
    onDeactivate();
    const tickBefore = useToolbarRegistry.getState().visibilityTick;

    mockCommands.listConflictFiles.mockResolvedValue(ok(["README.md"]));
    await act(async () => {
      await useConflictStore.getState().loadConflictFiles();
    });

    expect(useToolbarRegistry.getState().visibilityTick).toBe(tickBefore);
  });

  it("hides the toolbar badge when the merge is aborted in the app", async () => {
    const { api, fire, didHandlers } = createFakeApi();
    await onActivate(api);
    expect([...didHandlers.keys()]).toEqual(
      expect.arrayContaining(["merge", "merge-abort", "pull", "commit"]),
    );

    const toolbarConfig = vi.mocked(api.contributeToolbar).mock.calls[0][0];

    // A merge produced a conflict
    mockCommands.listConflictFiles.mockResolvedValue(ok(["README.md"]));
    await act(async () => {
      await fire("merge");
    });
    expect(toolbarConfig.when?.()).toBe(true);
    expect(queryClient.getQueryData(CONFLICT_FILES_QUERY_KEY)).toEqual([
      "README.md",
    ]);

    // `git merge --abort` clears the index conflicts
    const tickBefore = useToolbarRegistry.getState().visibilityTick;
    mockCommands.listConflictFiles.mockResolvedValue(ok([]));
    await act(async () => {
      await fire("merge-abort");
    });
    expect(toolbarConfig.when?.()).toBe(false);
    expect(useToolbarRegistry.getState().visibilityTick).toBe(tickBefore + 1);
    expect(queryClient.getQueryData(CONFLICT_FILES_QUERY_KEY)).toEqual([]);

    onDeactivate();
  });

  it("refreshConflictFiles mirrors the store list into the query cache", async () => {
    mockCommands.listConflictFiles.mockResolvedValue(ok(["a.ts", "b.ts"]));

    const paths = await refreshConflictFiles();

    expect(paths).toEqual(["a.ts", "b.ts"]);
    expect(queryClient.getQueryData(CONFLICT_FILES_QUERY_KEY)).toEqual([
      "a.ts",
      "b.ts",
    ]);
    expect(useConflictStore.getState().conflictCount()).toBe(2);
  });
});
