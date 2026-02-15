import { useQuery } from "@tanstack/react-query";
import { commands } from "../../../../bindings";
import type { DiffSource } from "../types";

export function useDiffQuery(source: DiffSource, contextLines = 3) {
  const queryKey =
    source.mode === "commit"
      ? ["commitFileDiff", source.oid, source.filePath, contextLines]
      : ["fileDiff", source.filePath, source.staged, contextLines];

  const queryFn =
    source.mode === "commit"
      ? () =>
          commands.getCommitFileDiff(source.oid, source.filePath, contextLines)
      : () =>
          commands.getFileDiff(source.filePath, source.staged, contextLines);

  return useQuery({
    queryKey,
    queryFn,
    staleTime: source.mode === "commit" ? 60000 : undefined,
  });
}
