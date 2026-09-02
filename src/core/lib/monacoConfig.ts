/**
 * Shared Monaco Editor configuration constants.
 *
 * Used by DiffBlade (DiffEditor) and ViewerCodeBlade (Editor).
 * Themes are registered in monacoTheme.ts (imported as a side effect).
 */
import type { ResolvedTheme } from "../stores/domain/preferences/theme.slice";

/** Monaco theme name registered for each resolved Catppuccin flavour. */
export const MONACO_THEMES = {
  latte: "flowforge-light",
  mocha: "flowforge-dark",
} as const satisfies Record<ResolvedTheme, string>;

export type MonacoTheme = (typeof MONACO_THEMES)[ResolvedTheme];

/** Map the app's resolved theme to the matching Monaco theme name. */
export function getMonacoTheme(resolved: ResolvedTheme): MonacoTheme {
  return MONACO_THEMES[resolved];
}

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
