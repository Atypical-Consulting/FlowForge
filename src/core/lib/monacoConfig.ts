/**
 * Shared Monaco Editor configuration constants.
 *
 * Used by DiffBlade (DiffEditor) and ViewerCodeBlade (Editor).
 * Theme is registered in monacoTheme.ts (imported as a side effect).
 */
export const MONACO_THEME = "flowforge-dark" as const;

export const MONACO_COMMON_OPTIONS = {
  readOnly: true,
  automaticLayout: true,
  scrollBeyondLastLine: false,
  minimap: { enabled: false },
  fontSize: 13,
  lineNumbers: "on" as const,
  folding: true,
  wordWrap: "off" as const,
  renderLineHighlight: "all" as const,
  scrollbar: {
    verticalScrollbarSize: 10,
    horizontalScrollbarSize: 10,
  },
} as const;
