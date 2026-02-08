/**
 * Resolve a relative path against a file's directory.
 *
 * Examples:
 *   resolveRelativePath("docs/guide.md", "./API.md") => "docs/API.md"
 *   resolveRelativePath("docs/guide.md", "../README.md") => "README.md"
 *   resolveRelativePath("guide.md", "./images/logo.png") => "images/logo.png"
 *   resolveRelativePath("a/b/c.md", "../../d.md") => "d.md"
 *
 * Used by MarkdownRenderer to resolve relative links and image paths.
 */
export function resolveRelativePath(
  currentFile: string,
  relativePath: string,
): string {
  const rel = relativePath;

  // Get the directory of the current file
  const dir = currentFile.includes("/")
    ? currentFile.substring(0, currentFile.lastIndexOf("/"))
    : "";

  // Combine directory and relative path
  const combined = dir ? `${dir}/${rel}` : rel;

  // Normalize: resolve . and .. segments
  const parts = combined.split("/");
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === "..") {
      resolved.pop();
    } else if (part !== "." && part !== "") {
      resolved.push(part);
    }
  }

  return resolved.join("/");
}
