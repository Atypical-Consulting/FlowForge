import "./monacoWorkers";
import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { MONACO_THEMES } from "./monacoConfig";

// Tell @monaco-editor/react to use locally bundled Monaco
loader.config({ monaco });

/**
 * Catppuccin palette subset used by the Monaco themes.
 * Monaco doesn't support CSS variables, so the hex values are inlined here
 * (kept in sync with `@catppuccin/tailwindcss`).
 */
interface CatppuccinPalette {
  crust: string;
  mantle: string;
  base: string;
  surface0: string;
  surface1: string;
  surface2: string;
  overlay0: string;
  overlay2: string;
  text: string;
  mauve: string;
  green: string;
  peach: string;
  teal: string;
  blue: string;
  red: string;
}

const MOCHA: CatppuccinPalette = {
  crust: "#11111b",
  mantle: "#181825",
  base: "#1e1e2e",
  surface0: "#313244",
  surface1: "#45475a",
  surface2: "#585b70",
  overlay0: "#6c7086",
  overlay2: "#9399b2",
  text: "#cdd6f4",
  mauve: "#cba6f7",
  green: "#a6e3a1",
  peach: "#fab387",
  teal: "#94e2d5",
  blue: "#89b4fa",
  red: "#f38ba8",
};

const LATTE: CatppuccinPalette = {
  crust: "#dce0e8",
  mantle: "#e6e9ef",
  base: "#eff1f5",
  surface0: "#ccd0da",
  surface1: "#bcc0cc",
  surface2: "#acb0be",
  overlay0: "#9ca0b0",
  overlay2: "#7c7f93",
  text: "#4c4f69",
  mauve: "#8839ef",
  green: "#40a02b",
  peach: "#fe640b",
  teal: "#179299",
  blue: "#1e66f5",
  red: "#d20f39",
};

/** Build a FlowForge Monaco theme from a Catppuccin flavour palette. */
function buildTheme(
  base: "vs" | "vs-dark",
  p: CatppuccinPalette,
  background: string,
): monaco.editor.IStandaloneThemeData {
  return {
    base,
    inherit: true,
    rules: [
      {
        token: "comment",
        foreground: p.overlay0.slice(1),
        fontStyle: "italic",
      },
      { token: "keyword", foreground: p.mauve.slice(1) },
      { token: "string", foreground: p.green.slice(1) },
      { token: "number", foreground: p.peach.slice(1) },
      { token: "type", foreground: p.teal.slice(1) },
      { token: "function", foreground: p.blue.slice(1) },
      { token: "variable", foreground: p.text.slice(1) },
      { token: "operator", foreground: p.overlay2.slice(1) },
    ],
    colors: {
      "editor.background": background,
      "editor.foreground": p.text,
      "editor.lineHighlightBackground": `${p.surface0}66`,
      "editor.selectionBackground": `${p.blue}40`,
      "editor.inactiveSelectionBackground": `${p.blue}20`,
      "editorLineNumber.foreground": p.overlay0,
      "editorLineNumber.activeForeground": p.overlay2,
      "editorCursor.foreground": p.blue,
      "editorWhitespace.foreground": p.surface1,
      "editorIndentGuide.background": p.surface1,
      "editorIndentGuide.activeBackground": p.surface2,
      "editor.wordHighlightBackground": `${p.blue}20`,
      // Word-level: 25% opacity for clear change boundaries
      "diffEditor.insertedTextBackground": `${p.green}40`,
      "diffEditor.removedTextBackground": `${p.red}40`,
      // Line-level: 6% opacity as subtle background wash
      "diffEditor.insertedLineBackground": `${p.green}10`,
      "diffEditor.removedLineBackground": `${p.red}10`,
      // Gutter: 18% opacity
      "diffEditorGutter.insertedLineBackground": `${p.green}30`,
      "diffEditorGutter.removedLineBackground": `${p.red}30`,
      // Collapsed unchanged regions
      "diffEditor.unchangedRegionBackground": p.mantle,
      "diffEditor.unchangedRegionForeground": p.overlay0,
      "diffEditor.unchangedCodeBackground": p.mantle,
      "scrollbarSlider.background": `${p.surface2}50`,
      "scrollbarSlider.hoverBackground": `${p.overlay0}70`,
      "scrollbarSlider.activeBackground": `${p.overlay2}80`,
    },
  };
}

/** Catppuccin Mocha (dark) theme, used when the app resolves to `mocha`. */
export const FLOWFORGE_DARK_THEME = buildTheme("vs-dark", MOCHA, MOCHA.crust);

/** Catppuccin Latte (light) theme, used when the app resolves to `latte`. */
export const FLOWFORGE_LIGHT_THEME = buildTheme("vs", LATTE, LATTE.base);

// Register themes synchronously (Monaco is available immediately)
monaco.editor.defineTheme(MONACO_THEMES.mocha, FLOWFORGE_DARK_THEME);
monaco.editor.defineTheme(MONACO_THEMES.latte, FLOWFORGE_LIGHT_THEME);
