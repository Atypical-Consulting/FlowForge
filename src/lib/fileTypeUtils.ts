import { bladeTypeForFile, isBinaryExtension } from "./fileDispatch";

/** Re-export for backward compatibility */
export { bladeTypeForFile, isBinaryExtension as isBinaryFile };

/** Returns true when the file gets a text diff (not a specialized viewer) */
export function isTextDiffable(filePath: string): boolean {
  return bladeTypeForFile(filePath, "diff") === "diff";
}
