import { create } from "zustand";
import { getErrorMessage } from "@/core/lib/errors";
import { invalidateRepositoryQueries } from "@/core/lib/repositoryRefresh";
import { registerStoreForReset } from "@/framework/stores/registry";
import { toast } from "@/framework/stores/toast";
import { commands } from "../../bindings";
import { buildResolvedContent } from "./lib/conflictParser";
import type {
  ConflictFile,
  ConflictHunk,
  FileResolutionStatus,
  ResolutionChoice,
  UndoEntry,
} from "./types";

function deriveStatus(hunks: ConflictHunk[]): FileResolutionStatus {
  const resolved = hunks.filter((h) => h.resolution !== null).length;
  if (resolved === 0) return "unresolved";
  if (resolved === hunks.length) return "resolved";
  return "partially-resolved";
}

function createPlaceholder(path: string): ConflictFile {
  return {
    path,
    loaded: false,
    status: "unresolved",
    hunks: [],
    oursFullContent: "",
    theirsFullContent: "",
    baseFullContent: "",
    resultContent: "",
    undoStack: [],
    oursName: "HEAD",
    theirsName: "MERGE_HEAD",
  };
}

function samePaths(files: Map<string, ConflictFile>, paths: string[]): boolean {
  if (files.size !== paths.length) return false;
  let i = 0;
  for (const key of files.keys()) {
    if (key !== paths[i++]) return false;
  }
  return true;
}

function unknownErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error ?? "Unknown error");
}

interface ConflictStore {
  files: Map<string, ConflictFile>;
  activeFilePath: string | null;
  /** Path whose ours/theirs content is currently being fetched. */
  loadingPath: string | null;

  // Actions
  /**
   * Refresh the conflicted-file list from the index. Resolves with the list
   * of conflicted paths (never undefined, so it can back a TanStack query).
   * On backend failure the current list is kept and returned.
   */
  loadConflictFiles: () => Promise<string[]>;
  /**
   * Make `path` the active file and fetch its ours/theirs/base content unless
   * it is already loaded. Re-selecting a loaded file never discards the
   * user's resolution progress. Resolves with the file, or null on failure.
   */
  openConflictFile: (path: string) => Promise<ConflictFile | null>;
  resolveHunk: (
    filePath: string,
    hunkId: string,
    choice: ResolutionChoice,
  ) => void;
  undoHunkResolution: (filePath: string) => void;
  updateResultContent: (filePath: string, content: string) => void;
  resetFile: (filePath: string) => void;
  /**
   * Write the result content to the working tree and stage the file. Resolves
   * with true on success; every failure is reported with a toast.
   */
  markFileResolved: (filePath: string) => Promise<boolean>;
  getActiveFile: () => ConflictFile | undefined;

  // Derived
  conflictCount: () => number;
  isFileFullyResolved: (filePath: string) => boolean;
}

export const useConflictStore = create<ConflictStore>()((set, get) => ({
  files: new Map(),
  activeFilePath: null,
  loadingPath: null,

  loadConflictFiles: async () => {
    let result: Awaited<ReturnType<typeof commands.listConflictFiles>>;
    try {
      result = await commands.listConflictFiles();
    } catch (error) {
      console.error("Failed to list conflict files:", error);
      return Array.from(get().files.keys());
    }
    if (result.status === "error") {
      console.error("Failed to list conflict files:", result.error);
      return Array.from(get().files.keys());
    }

    const paths = result.data;
    const current = get().files;

    // Same list as before: keep the same Map instance so subscribers (blade,
    // toolbar badge) are not re-rendered on every poll.
    if (samePaths(current, paths)) return paths;

    const files = new Map<string, ConflictFile>();
    for (const path of paths) {
      // Preserve existing file data (content, resolutions) if already loaded
      files.set(path, current.get(path) ?? createPlaceholder(path));
    }

    const { activeFilePath } = get();
    set({
      files,
      activeFilePath:
        activeFilePath && files.has(activeFilePath) ? activeFilePath : null,
    });
    return paths;
  },

  openConflictFile: async (path: string) => {
    const existing = get().files.get(path);
    if (existing?.loaded) {
      if (get().activeFilePath !== path) set({ activeFilePath: path });
      return existing;
    }

    set({ activeFilePath: path, loadingPath: path });

    const finishLoading = () => {
      if (get().loadingPath === path) set({ loadingPath: null });
    };

    let result: Awaited<ReturnType<typeof commands.getConflictContent>>;
    try {
      result = await commands.getConflictContent(path);
    } catch (error) {
      finishLoading();
      console.error("Failed to get conflict content:", error);
      toast.error(
        `Failed to load conflict ${path}: ${unknownErrorMessage(error)}`,
      );
      return null;
    }
    if (result.status === "error") {
      finishLoading();
      console.error("Failed to get conflict content:", result.error);
      toast.error(
        `Failed to load conflict ${path}: ${getErrorMessage(result.error)}`,
      );
      return null;
    }

    const data = result.data;
    const oursContent = data.ours ?? "";
    const theirsContent = data.theirs ?? "";
    const baseContent = data.base ?? "";

    // git2 gives us the clean ours/theirs blobs (index stages 2 and 3), not
    // the marker-laden working tree file, so the whole file is one hunk.
    const hunks: ConflictHunk[] = [];
    if (oursContent !== theirsContent) {
      hunks.push({
        id: "hunk-0",
        startLine: 1,
        endLine: Math.max(
          oursContent.split("\n").length,
          theirsContent.split("\n").length,
        ),
        oursContent,
        theirsContent,
        resolution: null,
      });
    }

    const file: ConflictFile = {
      path,
      loaded: true,
      status: deriveStatus(hunks),
      hunks,
      oursFullContent: oursContent,
      theirsFullContent: theirsContent,
      baseFullContent: baseContent,
      resultContent: oursContent, // Start with ours (VS Code convention)
      undoStack: [],
      oursName: data.oursName,
      theirsName: data.theirsName,
    };

    const files = new Map(get().files);
    files.set(path, file);
    set({
      files,
      loadingPath: get().loadingPath === path ? null : get().loadingPath,
    });
    return file;
  },

  resolveHunk: (filePath: string, hunkId: string, choice: ResolutionChoice) => {
    const files = new Map(get().files);
    const file = files.get(filePath);
    if (!file) return;

    const hunkIndex = file.hunks.findIndex((h) => h.id === hunkId);
    if (hunkIndex === -1) return;

    // Push undo entry
    const undoEntry: UndoEntry = {
      hunkId,
      previousResolution: file.hunks[hunkIndex].resolution,
      previousResultContent: file.resultContent,
    };

    const updatedHunks = file.hunks.map((h) =>
      h.id === hunkId ? { ...h, resolution: choice } : h,
    );

    // Build new result content based on the resolution choice
    let newResultContent: string;
    const hunk = updatedHunks[hunkIndex];

    if (updatedHunks.length === 1) {
      // Single hunk — just use the resolved content directly
      switch (choice) {
        case "ours":
          newResultContent = hunk.oursContent;
          break;
        case "theirs":
          newResultContent = hunk.theirsContent;
          break;
        case "both":
          newResultContent = `${hunk.oursContent}\n${hunk.theirsContent}`;
          break;
        case "custom":
          newResultContent = file.resultContent;
          break;
        default:
          newResultContent = file.resultContent;
      }
    } else {
      // Multi-hunk — rebuild from original with all resolved hunks
      newResultContent = buildResolvedContent(
        file.oursFullContent,
        updatedHunks,
      );
    }

    const updatedFile: ConflictFile = {
      ...file,
      hunks: updatedHunks,
      resultContent: newResultContent,
      status: deriveStatus(updatedHunks),
      undoStack: [...file.undoStack, undoEntry],
    };

    files.set(filePath, updatedFile);
    set({ files });
  },

  undoHunkResolution: (filePath: string) => {
    const files = new Map(get().files);
    const file = files.get(filePath);
    if (!file || file.undoStack.length === 0) return;

    const lastUndo = file.undoStack[file.undoStack.length - 1];
    const updatedHunks = file.hunks.map((h) =>
      h.id === lastUndo.hunkId
        ? { ...h, resolution: lastUndo.previousResolution }
        : h,
    );

    const updatedFile: ConflictFile = {
      ...file,
      hunks: updatedHunks,
      resultContent: lastUndo.previousResultContent,
      status: deriveStatus(updatedHunks),
      undoStack: file.undoStack.slice(0, -1),
    };

    files.set(filePath, updatedFile);
    set({ files });
  },

  updateResultContent: (filePath: string, content: string) => {
    const files = new Map(get().files);
    const file = files.get(filePath);
    if (!file) return;

    files.set(filePath, { ...file, resultContent: content });
    set({ files });
  },

  resetFile: (filePath: string) => {
    const files = new Map(get().files);
    const file = files.get(filePath);
    if (!file) return;

    const resetHunks = file.hunks.map((h) => ({
      ...h,
      resolution: null as ResolutionChoice | null,
    }));

    files.set(filePath, {
      ...file,
      hunks: resetHunks,
      resultContent: file.oursFullContent,
      status: "unresolved" as const,
      undoStack: [],
    });
    set({ files });
    toast.info(`Reset: ${filePath}`);
  },

  markFileResolved: async (filePath: string) => {
    const file = get().files.get(filePath);
    if (!file) {
      toast.error(`Cannot resolve ${filePath}: not in the conflict list`);
      return false;
    }
    if (!file.loaded) {
      toast.error(`Cannot resolve ${filePath}: conflict content not loaded`);
      return false;
    }

    let result: Awaited<ReturnType<typeof commands.resolveConflictFile>>;
    try {
      result = await commands.resolveConflictFile(filePath, file.resultContent);
    } catch (error) {
      console.error("Failed to resolve conflict:", error);
      toast.error(
        `Failed to resolve ${filePath}: ${unknownErrorMessage(error)}`,
      );
      return false;
    }
    if (result.status === "error") {
      console.error("Failed to resolve conflict:", result.error);
      toast.error(
        `Failed to resolve ${filePath}: ${getErrorMessage(result.error)}`,
      );
      return false;
    }

    // Remove file from the map
    const files = new Map(get().files);
    files.delete(filePath);

    // If the resolved file was active, clear active
    const activeFilePath =
      get().activeFilePath === filePath ? null : get().activeFilePath;

    set({ files, activeFilePath });
    // The file left the index conflict set and is now staged: refresh the
    // staging blade, repo status and the conflict list query.
    invalidateRepositoryQueries();
    toast.success(`${filePath} resolved and staged`);
    return true;
  },

  getActiveFile: () => {
    const { files, activeFilePath } = get();
    return activeFilePath ? files.get(activeFilePath) : undefined;
  },

  conflictCount: () => {
    return get().files.size;
  },

  isFileFullyResolved: (filePath: string) => {
    const file = get().files.get(filePath);
    if (!file || !file.loaded) return false;
    return file.hunks.every((h) => h.resolution !== null);
  },
}));

registerStoreForReset(useConflictStore);
