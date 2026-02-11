/**
 * Monaco Editor worker configuration for local bundling.
 *
 * Must be imported BEFORE `monaco-editor` so the environment is ready
 * when Monaco initializes its worker infrastructure.
 */
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";

(globalThis as Record<string, unknown>).MonacoEnvironment = {
  getWorker() {
    return new editorWorker();
  },
};
