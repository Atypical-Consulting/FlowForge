import { getCommandById, useCommandRegistry } from "./commandRegistry";

/**
 * Read the shortcut a command is registered with.
 *
 * The command registry is the single source of truth for shortcut hints:
 * menus, toolbar tooltips, overflow menus and settings panels must display
 * this value rather than a locally hard-coded string, so a hint can never
 * drift from what the command palette advertises.
 */
export function getCommandShortcut(
  commandId: string | undefined,
): string | undefined {
  if (!commandId) return undefined;
  return getCommandById(commandId)?.shortcut;
}

/**
 * Reactive variant of {@link getCommandShortcut}: re-renders when the command
 * is (un)registered or its shortcut changes, e.g. when an extension activates
 * after the component mounted.
 */
export function useCommandShortcut(
  commandId: string | undefined,
): string | undefined {
  return useCommandRegistry((s) =>
    commandId ? s.items.get(commandId)?.shortcut : undefined,
  );
}
