import { create } from "zustand";
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

interface ConflictStore {
  files: Map<string, ConflictFile>;
  activeFilePath: string | null;

  // Actions
  loadConflictFiles: () => Promise<void>;
  openConflictFile: (path: string) => Promise<void>;
  resolveHunk: (
    filePath: string,
    hunkId: string,
    choice: ResolutionChoice,
  ) => void;
  undoHunkResolution: (filePath: string) => void;
  updateResultContent: (filePath: string, content: string) => void;
  resetFile: (filePath: string) => void;
  markFileResolved: (filePath: string) => Promise<boolean>;
  getActiveFile: () => ConflictFile | undefined;

  // Derived
  conflictCount: () => number;
  isFileFullyResolved: (filePath: string) => boolean;
}

export const useConflictStore = create<ConflictStore>()((set, get) => ({
  files: new Map(),
  activeFilePath: null,

  loadConflictFiles: async () => {
    const result = await commands.listConflictFiles();
    if (result.status === "error") {
      console.error("Failed to list conflict files:", result.error);
      return;
    }

    const paths = result.data;
    const files = new Map<string, ConflictFile>();

    for (const path of paths) {
      // Preserve existing file data if already loaded
      const existing = get().files.get(path);
      if (existing) {
        files.set(path, existing);
      } else {
        files.set(path, {
          path,
          status: "unresolved",
          hunks: [],
          oursFullContent: "",
          theirsFullContent: "",
          baseFullContent: "",
          resultContent: "",
          undoStack: [],
          oursName: "HEAD",
          theirsName: "MERGE_HEAD",
        });
      }
    }

    set({ files });
  },

  openConflictFile: async (path: string) => {
    const result = await commands.getConflictContent(path);
    if (result.status === "error") {
      console.error("Failed to get conflict content:", result.error);
      toast.error(`Failed to load conflict: ${path}`);
      return;
    }

    const data = result.data;
    const oursContent = data.ours ?? "";
    const theirsContent = data.theirs ?? "";
    const baseContent = data.base ?? "";

    // Read working directory file to parse conflict markers
    // The working directory file has the markers; use ours content as initial result
    const files = new Map(get().files);
    const existing = files.get(path);

    // Parse conflict markers from a synthetic marker format
    // since we have clean ours/theirs from git2, we construct hunks from the diff
    // For now, we create a single hunk representing the whole-file conflict
    // The parser will be used if we have marker-containing content
    const hunks: ConflictHunk[] = [];

    // If the content differs, create a hunk
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
      status: deriveStatus(hunks),
      hunks,
      oursFullContent: oursContent,
      theirsFullContent: theirsContent,
      baseFullContent: baseContent,
      resultContent: oursContent, // Start with ours (VS Code convention)
      undoStack: existing?.undoStack ?? [],
      oursName: data.oursName,
      theirsName: data.theirsName,
    };

    files.set(path, file);
    set({ files, activeFilePath: path });
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
    if (!file) return false;

    const result = await commands.resolveConflictFile(
      filePath,
      file.resultContent,
    );
    if (result.status === "error") {
      toast.error(`Failed to resolve: ${filePath}`);
      console.error("Failed to resolve conflict:", result.error);
      return false;
    }

    // Remove file from the map
    const files = new Map(get().files);
    files.delete(filePath);

    // If the resolved file was active, clear active
    const activeFilePath =
      get().activeFilePath === filePath ? null : get().activeFilePath;

    set({ files, activeFilePath });
    toast.success(`Resolved: ${filePath}`);
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
    if (!file) return false;
    return file.hunks.every((h) => h.resolution !== null);
  },
}));

registerStoreForReset(useConflictStore);
