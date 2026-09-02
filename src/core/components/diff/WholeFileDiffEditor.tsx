import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useMonacoTheme } from "../../hooks/useMonacoTheme";
import "../../lib/monacoTheme";
import {
  buildWholeFileDecorations,
  type WholeFileDiffKind,
} from "./wholeFileDecorations";

/** Minimum width of the line-decorations column so the +/- sign stays visible. */
const MIN_SIGN_COLUMN_WIDTH = 16;

interface WholeFileDiffEditorProps {
  /** The only side that exists: the new content for an added file, the old one for a deleted file. */
  content: string;
  kind: WholeFileDiffKind;
  language: string;
  /** Base editor options; read-only mode and the sign column are enforced on top. */
  options?: editor.IStandaloneEditorConstructionOptions;
  /** Receives the code editor once Monaco has created it (scroll sync, decorations, ...). */
  onMount?: (codeEditor: editor.IStandaloneCodeEditor) => void;
}

/**
 * Diff view for a file that exists on one side only (untracked/added or
 * deleted).
 *
 * A Monaco text model can never be empty: an empty document is a single empty
 * line. Feeding such an "original" to the DiffEditor makes its diff computer
 * report "delete line 1 + insert everything" (see
 * `DefaultLinesDiffComputer.computeDiff`), which rendered a phantom removed
 * empty line above every new file. Instead of a two-sided diff, render the
 * only real side in a plain editor and mark every line as added or removed
 * with the same decorations the DiffEditor uses, so it looks identical minus
 * the phantom row.
 */
export function WholeFileDiffEditor({
  content,
  kind,
  language,
  options,
  onMount,
}: WholeFileDiffEditorProps) {
  const monacoTheme = useMonacoTheme();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<editor.IEditorDecorationsCollection | null>(
    null,
  );
  const contentListenerRef = useRef<{ dispose: () => void } | null>(null);
  const kindRef = useRef(kind);
  kindRef.current = kind;
  const onMountRef = useRef(onMount);
  onMountRef.current = onMount;

  const applyDecorations = useCallback((currentKind: WholeFileDiffKind) => {
    const codeEditor = editorRef.current;
    const model = codeEditor?.getModel();
    if (!codeEditor || !model) return;
    const decorations = buildWholeFileDecorations(
      model.getLineCount(),
      currentKind,
    );
    if (decorationsRef.current) {
      decorationsRef.current.set(decorations);
    } else {
      decorationsRef.current =
        codeEditor.createDecorationsCollection(decorations);
    }
  }, []);

  const handleMount: OnMount = (codeEditor) => {
    editorRef.current = codeEditor;
    applyDecorations(kindRef.current);
    // @monaco-editor/react updates the model in place when `value` changes
    // (the editor is reused, not remounted), so re-decorate on every edit.
    contentListenerRef.current?.dispose();
    contentListenerRef.current = codeEditor.onDidChangeModelContent(() =>
      applyDecorations(kindRef.current),
    );
    onMountRef.current?.(codeEditor);
  };

  // Switching from an added to a deleted file with identical content would
  // not fire a content change, so also re-decorate when the kind changes.
  useEffect(() => {
    applyDecorations(kind);
  }, [kind, applyDecorations]);

  useEffect(() => {
    return () => {
      contentListenerRef.current?.dispose();
      contentListenerRef.current = null;
      decorationsRef.current = null;
      editorRef.current = null;
    };
  }, []);

  const editorOptions =
    useMemo<editor.IStandaloneEditorConstructionOptions>(() => {
      const requested = options?.lineDecorationsWidth;
      const lineDecorationsWidth =
        typeof requested === "number" && requested >= MIN_SIGN_COLUMN_WIDTH
          ? requested
          : MIN_SIGN_COLUMN_WIDTH;
      return {
        ...options,
        readOnly: true,
        domReadOnly: true,
        lineDecorationsWidth,
      };
    }, [options]);

  return (
    <Editor
      value={content}
      language={language}
      theme={monacoTheme}
      options={editorOptions}
      onMount={handleMount}
    />
  );
}
