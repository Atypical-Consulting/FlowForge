import "./monacoWorkers";
import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";

// Tell @monaco-editor/react to use locally bundled Monaco
loader.config({ monaco });

// Custom theme matching Catppuccin Mocha color scheme
// Using CSS variable hex values for Monaco (Monaco doesn't support CSS variables directly)
const FLOWFORGE_THEME: monaco.editor.IStandaloneThemeData = {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "comment", foreground: "6c7086", fontStyle: "italic" }, // ctp-overlay0
    { token: "keyword", foreground: "cba6f7" }, // ctp-mauve
    { token: "string", foreground: "a6e3a1" }, // ctp-green
    { token: "number", foreground: "fab387" }, // ctp-peach
    { token: "type", foreground: "94e2d5" }, // ctp-teal
    { token: "function", foreground: "89b4fa" }, // ctp-blue
    { token: "variable", foreground: "cdd6f4" }, // ctp-text
    { token: "operator", foreground: "9399b2" }, // ctp-overlay2
  ],
  colors: {
    "editor.background": "#11111b", // ctp-crust
    "editor.foreground": "#cdd6f4", // ctp-text
    "editor.lineHighlightBackground": "#31324466", // ctp-surface0 with transparency
    "editor.selectionBackground": "#89b4fa40", // ctp-blue with transparency
    "editor.inactiveSelectionBackground": "#89b4fa20", // ctp-blue with less transparency
    "editorLineNumber.foreground": "#6c7086", // ctp-overlay0
    "editorLineNumber.activeForeground": "#9399b2", // ctp-overlay2
    "editorCursor.foreground": "#89b4fa", // ctp-blue
    "editorWhitespace.foreground": "#45475a", // ctp-surface1
    "editorIndentGuide.background": "#45475a", // ctp-surface1
    "editorIndentGuide.activeBackground": "#585b70", // ctp-surface2
    "editor.wordHighlightBackground": "#89b4fa20", // ctp-blue with transparency
    // Word-level: 25% opacity for clear change boundaries
    "diffEditor.insertedTextBackground": "#a6e3a140", // ctp-green word-level additions
    "diffEditor.removedTextBackground": "#f38ba840", // ctp-red word-level deletions
    // Line-level: 6% opacity as subtle background wash
    "diffEditor.insertedLineBackground": "#a6e3a110", // ctp-green line background
    "diffEditor.removedLineBackground": "#f38ba810", // ctp-red line background
    // Gutter: 18% opacity
    "diffEditorGutter.insertedLineBackground": "#a6e3a130", // ctp-green gutter
    "diffEditorGutter.removedLineBackground": "#f38ba830", // ctp-red gutter
    // Collapsed unchanged regions
    "diffEditor.unchangedRegionBackground": "#181825", // ctp-mantle
    "diffEditor.unchangedRegionForeground": "#6c7086", // ctp-overlay0
    "diffEditor.unchangedCodeBackground": "#181825", // ctp-mantle
    "scrollbarSlider.background": "#58587050", // ctp-surface2 with transparency
    "scrollbarSlider.hoverBackground": "#6c708670", // ctp-overlay0 with transparency
    "scrollbarSlider.activeBackground": "#9399b280", // ctp-overlay2 with transparency
  },
};

// Register theme synchronously (Monaco is available immediately)
monaco.editor.defineTheme("flowforge-dark", FLOWFORGE_THEME);
