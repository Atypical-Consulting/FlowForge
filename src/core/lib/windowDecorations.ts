import { invoke } from "@tauri-apps/api/core";

/**
 * User preference for the client-side window title bar.
 *
 * - `auto`: hide it on tiling Wayland compositors (Hyprland, sway, river,
 *   niri, ...) where the compositor manages windows; keep it elsewhere.
 * - `always`: force the title bar on.
 * - `never`: force the title bar off.
 */
export type WindowDecorationsMode = "auto" | "always" | "never";

export const WINDOW_DECORATIONS_MODES: readonly WindowDecorationsMode[] = [
  "auto",
  "always",
  "never",
];

export function isWindowDecorationsMode(
  value: unknown,
): value is WindowDecorationsMode {
  return (WINDOW_DECORATIONS_MODES as readonly unknown[]).includes(value);
}

// Typed wrappers around the Rust `window` commands. They go through `invoke`
// directly because `src/bindings.ts` is regenerated only by the debug binary;
// once it is, these can be swapped for `commands.setWindowDecorations` and
// `commands.getDefaultWindowDecorations`.

/** Whether the runtime detection on this machine keeps decorations shown. */
export function getDefaultWindowDecorations(): Promise<boolean> {
  return invoke<boolean>("get_default_window_decorations");
}

/** Show (`true`) or hide (`false`) the main window's client-side decorations. */
export async function setWindowDecorations(enabled: boolean): Promise<void> {
  await invoke<null>("set_window_decorations", { enabled });
}

/** Resolve a preference to a concrete decoration state and apply it. */
export async function applyWindowDecorations(
  mode: WindowDecorationsMode,
): Promise<void> {
  const enabled =
    mode === "auto" ? await getDefaultWindowDecorations() : mode === "always";
  await setWindowDecorations(enabled);
}
