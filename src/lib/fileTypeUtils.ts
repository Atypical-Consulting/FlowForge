import type { BladeType } from "../stores/bladeTypes";

const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "bmp",
  "exe", "dll", "so", "dylib", "bin", "dat", "wasm",
  "nupkg", "zip", "tar", "gz", "7z", "rar",
  "pdf", "doc", "docx", "xls", "xlsx",
  "mp3", "wav", "ogg", "mp4", "avi", "mov",
  "woff", "woff2", "ttf", "otf", "eot",
  "glb", "gltf", "obj", "fbx",
]);

/** Map file extension to a specialized blade type, or "diff" as default */
export function bladeTypeForFile(filePath: string): BladeType {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".nupkg")) return "viewer-nupkg";
  if (
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".gif") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".svg") ||
    lower.endsWith(".ico")
  )
    return "viewer-image";
  if (lower.endsWith(".md") || lower.endsWith(".mdx"))
    return "viewer-markdown";
  if (lower.endsWith(".glb") || lower.endsWith(".gltf")) return "viewer-3d";
  return "diff";
}

/** Returns true when the file gets a text diff (not a specialized viewer) */
export function isTextDiffable(filePath: string): boolean {
  return bladeTypeForFile(filePath) === "diff";
}

/** Checks against known binary extensions */
export function isBinaryFile(filePath: string): boolean {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return BINARY_EXTENSIONS.has(ext);
}
