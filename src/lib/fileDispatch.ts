import type { BladeType } from "../stores/bladeTypes";

/**
 * Declarative mapping from file extension to blade type.
 *
 * Adding a new file type mapping = adding one line here.
 * The BladeType constraint ensures the target blade type exists in BladePropsMap.
 */
const FILE_DISPATCH_MAP: ReadonlyMap<string, BladeType> = new Map([
  // Images
  ["png", "viewer-image"],
  ["jpg", "viewer-image"],
  ["jpeg", "viewer-image"],
  ["gif", "viewer-image"],
  ["webp", "viewer-image"],
  ["svg", "viewer-image"],
  ["ico", "viewer-image"],
  ["bmp", "viewer-image"],

  // Markdown
  ["md", "viewer-markdown"],
  ["mdx", "viewer-markdown"],

  // 3D models
  ["glb", "viewer-3d"],
  ["gltf", "viewer-3d"],

  // Packages
  ["nupkg", "viewer-nupkg"],
]);

/**
 * Extensions known to be binary (no text preview fallback).
 */
const BINARY_EXTENSIONS: ReadonlySet<string> = new Set([
  "exe", "dll", "so", "dylib", "bin", "dat", "wasm",
  "zip", "tar", "gz", "7z", "rar",
  "pdf", "doc", "docx", "xls", "xlsx",
  "mp3", "wav", "ogg", "mp4", "avi", "mov",
  "woff", "woff2", "ttf", "otf", "eot",
  "obj", "fbx", "stl",
]);

function getExtension(filePath: string): string {
  return filePath.split(".").pop()?.toLowerCase() ?? "";
}

/**
 * Determine the blade type for a file, with context-aware fallback.
 *
 * @param filePath - file path (relative or absolute)
 * @param context  - "diff" for staging/commit context, "browse" for repo browser
 * @returns the blade type to open
 */
export function bladeTypeForFile(
  filePath: string,
  context: "diff" | "browse" = "diff",
): BladeType {
  const ext = getExtension(filePath);
  const mapped = FILE_DISPATCH_MAP.get(ext);
  if (mapped) return mapped;

  // Context-aware fallback
  if (context === "browse") {
    return "viewer-plaintext";
  }

  return "diff"; // Staging/commit context defaults to diff view
}

/**
 * Check if a file has a specialized viewer (not a diff or generic code fallback).
 */
export function hasSpecializedViewer(filePath: string): boolean {
  const ext = getExtension(filePath);
  return FILE_DISPATCH_MAP.has(ext);
}

/**
 * Check if a file extension is known to be binary.
 */
export function isBinaryExtension(filePath: string): boolean {
  const ext = getExtension(filePath);
  return BINARY_EXTENSIONS.has(ext);
}
