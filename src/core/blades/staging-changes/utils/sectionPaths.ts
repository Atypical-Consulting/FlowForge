import type { FileChange } from "../../../../bindings";

/**
 * Collect the pathspecs needed to stage/unstage exactly the given files.
 *
 * A renamed entry is reported under its new path, but staging the rename
 * also requires the old path so the index drops the removed side. Paths are
 * deduplicated while preserving order.
 */
export function getSectionPaths(files: FileChange[]): string[] {
  const paths = new Set<string>();
  for (const file of files) {
    paths.add(file.path);
    if (typeof file.status === "object" && "renamed" in file.status) {
      paths.add(file.status.renamed.old_path);
    }
  }
  return Array.from(paths);
}
