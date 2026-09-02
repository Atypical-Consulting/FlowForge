/**
 * Global guard against the WebView's native context menu.
 *
 * FlowForge renders its own context menus through the context-menu registry.
 * Without this guard, right-clicking anywhere that does not handle
 * `contextmenu` itself opens WebKitGTK's built-in menu
 * ("Back / Forward / Stop / Reload / Inspect Element"), and "Reload" there
 * reloads the whole SPA and drops all in-memory state.
 *
 * Two escape hatches keep the native menu:
 *   1. Editable targets (`input`, `textarea`, `[contenteditable]`) so users
 *      keep the native cut / copy / paste / spellcheck entries.
 *   2. In development builds (`import.meta.env.DEV`), holding Shift while
 *      right-clicking bypasses the guard so developers can still reach
 *      "Inspect Element" (Shift+RightClick).
 */

const EDITABLE_SELECTOR =
  'input, textarea, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]';

/** Input types that carry no editable text, so the native menu adds nothing. */
const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "submit",
  "reset",
  "checkbox",
  "radio",
  "range",
  "color",
  "file",
  "image",
]);

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const el = target.closest(EDITABLE_SELECTOR);
  if (!el) return false;
  if (el instanceof HTMLInputElement) {
    return !NON_TEXT_INPUT_TYPES.has(el.type);
  }
  return true;
}

export interface NativeContextMenuGuardOptions {
  /** Whether the Shift+RightClick developer escape hatch is active. */
  dev?: boolean;
}

/**
 * Decide whether the browser's native context menu should be allowed for
 * this `contextmenu` event.
 */
export function shouldAllowNativeContextMenu(
  event: MouseEvent,
  options: NativeContextMenuGuardOptions = {},
): boolean {
  const dev = options.dev ?? import.meta.env.DEV;
  // Developer escape hatch: Shift+RightClick in dev builds keeps the native
  // menu so "Inspect Element" stays reachable.
  if (dev && event.shiftKey) return true;
  return isEditableTarget(event.target);
}

/**
 * Install the document-level `contextmenu` guard. Returns a disposer.
 *
 * Registered in the bubbling phase so component-level `onContextMenu`
 * handlers (which open the custom menu) run first; they already call
 * `preventDefault()` themselves, so calling it again here is harmless.
 */
export function installNativeContextMenuGuard(
  options: NativeContextMenuGuardOptions = {},
): () => void {
  const handler = (event: MouseEvent) => {
    if (shouldAllowNativeContextMenu(event, options)) return;
    event.preventDefault();
  };
  document.addEventListener("contextmenu", handler);
  return () => document.removeEventListener("contextmenu", handler);
}
