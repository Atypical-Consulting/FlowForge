export type ResolutionChoice = "ours" | "theirs" | "both" | "custom";
export type FileResolutionStatus =
  | "unresolved"
  | "partially-resolved"
  | "resolved";

export interface ConflictHunk {
  id: string;
  startLine: number;
  endLine: number;
  oursContent: string;
  theirsContent: string;
  resolution: ResolutionChoice | null;
}

export interface UndoEntry {
  hunkId: string;
  previousResolution: ResolutionChoice | null;
  previousResultContent: string;
}

export interface ConflictFile {
  path: string;
  /**
   * False until `openConflictFile` has fetched ours/theirs/base from the
   * backend. A placeholder from the file list has empty contents and no hunks.
   */
  loaded: boolean;
  status: FileResolutionStatus;
  hunks: ConflictHunk[];
  oursFullContent: string;
  theirsFullContent: string;
  baseFullContent: string;
  resultContent: string;
  undoStack: UndoEntry[];
  oursName: string;
  theirsName: string;
}
