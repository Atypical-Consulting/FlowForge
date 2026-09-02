import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConflictContent } from "../../../bindings";
import { err, ok } from "../../../core/test-utils/mocks/tauri-commands";

const mockCommands = vi.hoisted(() => ({
  listConflictFiles: vi.fn(),
  getConflictContent: vi.fn(),
  resolveConflictFile: vi.fn(),
}));

const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}));

const mockInvalidateRepositoryQueries = vi.hoisted(() => vi.fn());

vi.mock("../../../bindings", () => ({ commands: mockCommands }));
vi.mock("@/framework/stores/toast", () => ({ toast: mockToast }));
vi.mock("@/core/lib/repositoryRefresh", () => ({
  invalidateRepositoryQueries: mockInvalidateRepositoryQueries,
}));

import { useConflictStore } from "../store";

const README_CONFLICT: ConflictContent = {
  path: "README.md",
  ours: "Conflict line from develop\n",
  theirs: "Conflict line from conflict-a\n",
  base: "Original line\n",
  oursName: "develop",
  theirsName: "conflict-a",
};

describe("conflict store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCommands.listConflictFiles.mockResolvedValue(ok(["README.md"]));
    mockCommands.getConflictContent.mockResolvedValue(ok(README_CONFLICT));
    mockCommands.resolveConflictFile.mockResolvedValue(ok(null));
  });

  describe("loadConflictFiles", () => {
    it("resolves with the conflicted paths and fills the store with placeholders", async () => {
      const paths = await useConflictStore.getState().loadConflictFiles();

      expect(paths).toEqual(["README.md"]);
      const file = useConflictStore.getState().files.get("README.md");
      expect(file).toMatchObject({ path: "README.md", loaded: false });
    });

    it("keeps the same Map instance when the list did not change", async () => {
      const store = useConflictStore.getState();
      await store.loadConflictFiles();
      const first = useConflictStore.getState().files;

      await store.loadConflictFiles();

      expect(useConflictStore.getState().files).toBe(first);
    });

    it("never resolves with undefined, even when the backend fails", async () => {
      const store = useConflictStore.getState();
      await store.loadConflictFiles();
      mockCommands.listConflictFiles.mockResolvedValue(
        err({ type: "NotFound", message: "No repository open" }),
      );

      const paths = await store.loadConflictFiles();

      expect(paths).toEqual(["README.md"]);
      expect(useConflictStore.getState().files.has("README.md")).toBe(true);
    });

    it("keeps loaded content for files that stay conflicted and drops resolved ones", async () => {
      const store = useConflictStore.getState();
      mockCommands.listConflictFiles.mockResolvedValue(
        ok(["README.md", "src/a.ts"]),
      );
      await store.loadConflictFiles();
      await store.openConflictFile("README.md");

      mockCommands.listConflictFiles.mockResolvedValue(ok(["README.md"]));
      await store.loadConflictFiles();

      const { files } = useConflictStore.getState();
      expect([...files.keys()]).toEqual(["README.md"]);
      expect(files.get("README.md")?.oursFullContent).toBe(
        README_CONFLICT.ours,
      );
    });
  });

  describe("openConflictFile", () => {
    it("fills ours/theirs/base from the backend and builds a single hunk", async () => {
      const store = useConflictStore.getState();
      await store.loadConflictFiles();

      const file = await store.openConflictFile("README.md");

      expect(mockCommands.getConflictContent).toHaveBeenCalledWith("README.md");
      expect(file).not.toBeNull();
      expect(file).toMatchObject({
        loaded: true,
        oursFullContent: README_CONFLICT.ours,
        theirsFullContent: README_CONFLICT.theirs,
        baseFullContent: README_CONFLICT.base,
        resultContent: README_CONFLICT.ours,
        oursName: "develop",
        theirsName: "conflict-a",
        status: "unresolved",
      });
      expect(file?.hunks).toHaveLength(1);
      expect(file?.hunks[0]).toMatchObject({
        oursContent: README_CONFLICT.ours,
        theirsContent: README_CONFLICT.theirs,
        resolution: null,
      });
      const state = useConflictStore.getState();
      expect(state.activeFilePath).toBe("README.md");
      expect(state.loadingPath).toBeNull();
      expect(state.files.get("README.md")).toEqual(file);
    });

    it("marks the file as loading while the backend call is pending", async () => {
      let resolveContent: (value: unknown) => void = () => {};
      mockCommands.getConflictContent.mockReturnValue(
        new Promise((resolve) => {
          resolveContent = resolve;
        }),
      );
      const store = useConflictStore.getState();

      const pending = store.openConflictFile("README.md");
      expect(useConflictStore.getState().loadingPath).toBe("README.md");
      expect(useConflictStore.getState().activeFilePath).toBe("README.md");

      resolveContent(ok(README_CONFLICT));
      await pending;
      expect(useConflictStore.getState().loadingPath).toBeNull();
    });

    it("does not refetch an already loaded file, so resolution progress survives re-selection", async () => {
      const store = useConflictStore.getState();
      await store.openConflictFile("README.md");
      store.resolveHunk("README.md", "hunk-0", "theirs");

      const again = await store.openConflictFile("README.md");

      expect(mockCommands.getConflictContent).toHaveBeenCalledTimes(1);
      expect(again?.hunks[0].resolution).toBe("theirs");
      expect(again?.resultContent).toBe(README_CONFLICT.theirs);
    });

    it("reports backend failures with a toast and resolves with null", async () => {
      mockCommands.getConflictContent.mockResolvedValue(
        err({ type: "FileNotConflicted", message: "README.md" }),
      );

      const file = await useConflictStore
        .getState()
        .openConflictFile("README.md");

      expect(file).toBeNull();
      expect(mockToast.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to load conflict README.md"),
      );
      expect(useConflictStore.getState().loadingPath).toBeNull();
    });
  });

  describe("resolveHunk + markFileResolved", () => {
    it("writes the chosen side to disk, stages it and removes the file from the list", async () => {
      const store = useConflictStore.getState();
      await store.loadConflictFiles();
      await store.openConflictFile("README.md");

      store.resolveHunk("README.md", "hunk-0", "theirs");
      expect(useConflictStore.getState().files.get("README.md")).toMatchObject({
        status: "resolved",
        resultContent: README_CONFLICT.theirs,
      });
      expect(store.isFileFullyResolved("README.md")).toBe(true);

      const resolved = await store.markFileResolved("README.md");

      expect(resolved).toBe(true);
      expect(mockCommands.resolveConflictFile).toHaveBeenCalledWith(
        "README.md",
        README_CONFLICT.theirs,
      );
      expect(useConflictStore.getState().files.has("README.md")).toBe(false);
      expect(useConflictStore.getState().activeFilePath).toBeNull();
      expect(mockToast.success).toHaveBeenCalledWith(
        "README.md resolved and staged",
      );
      expect(mockInvalidateRepositoryQueries).toHaveBeenCalled();
    });

    it("sends the manually edited result when the user typed in the result editor", async () => {
      const store = useConflictStore.getState();
      await store.openConflictFile("README.md");
      store.resolveHunk("README.md", "hunk-0", "both");
      store.updateResultContent("README.md", "hand-merged\n");

      await store.markFileResolved("README.md");

      expect(mockCommands.resolveConflictFile).toHaveBeenCalledWith(
        "README.md",
        "hand-merged\n",
      );
    });

    it("surfaces a backend error with a toast and keeps the file", async () => {
      mockCommands.resolveConflictFile.mockResolvedValue(
        err({ type: "NoMergeInProgress" }),
      );
      const store = useConflictStore.getState();
      await store.openConflictFile("README.md");
      store.resolveHunk("README.md", "hunk-0", "ours");

      const resolved = await store.markFileResolved("README.md");

      expect(resolved).toBe(false);
      expect(mockToast.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to resolve README.md"),
      );
      expect(mockToast.success).not.toHaveBeenCalled();
      expect(useConflictStore.getState().files.has("README.md")).toBe(true);
    });

    it("surfaces a rejected invoke (IPC failure) with a toast", async () => {
      mockCommands.resolveConflictFile.mockRejectedValue(new Error("ipc down"));
      const store = useConflictStore.getState();
      await store.openConflictFile("README.md");
      store.resolveHunk("README.md", "hunk-0", "ours");

      const resolved = await store.markFileResolved("README.md");

      expect(resolved).toBe(false);
      expect(mockToast.error).toHaveBeenCalledWith(
        "Failed to resolve README.md: ipc down",
      );
    });

    it("refuses to resolve a file whose content was never loaded", async () => {
      const store = useConflictStore.getState();
      await store.loadConflictFiles();

      const resolved = await store.markFileResolved("README.md");

      expect(resolved).toBe(false);
      expect(mockCommands.resolveConflictFile).not.toHaveBeenCalled();
      expect(mockToast.error).toHaveBeenCalled();
      expect(store.isFileFullyResolved("README.md")).toBe(false);
    });
  });
});
