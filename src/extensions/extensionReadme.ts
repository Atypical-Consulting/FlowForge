const readmeFiles = import.meta.glob<string>("./*/README.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

/**
 * Get the README.md content for a given extension ID.
 * Returns null if no README exists for that extension.
 */
export function getExtensionReadme(extensionId: string): string | null {
  const key = `./${extensionId}/README.md`;
  return readmeFiles[key] ?? null;
}
