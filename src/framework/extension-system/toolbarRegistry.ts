import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  getCommandShortcut,
  useCommandShortcut,
} from "../command-palette/useCommandShortcut";
import { createRegistry } from "../stores/createRegistry";

// --- Types ---

/**
 * Visual group for toolbar actions.
 * Union type so Phase 33 extensions can declare custom groups.
 */
export type ToolbarGroup = "navigation" | "git-actions" | "views" | "app";

/**
 * Defines the visual rendering order of groups in the toolbar (left to right).
 */
export const TOOLBAR_GROUP_ORDER: ToolbarGroup[] = [
  "navigation",
  "git-actions",
  "views",
  "app",
];

/**
 * A single toolbar action registration.
 *
 * Core actions use IDs like "tb:{name}".
 * Extensions (Phase 33) will use "ext:{extId}:{name}".
 */
export interface ToolbarAction {
  /** Unique ID. Core: "tb:{name}". Extensions: "ext:{extId}:{name}" */
  id: string;
  /** Display label for tooltip + overflow menu text */
  label: string;
  /** Icon component for icon-only rendering */
  icon: LucideIcon;
  /** Visual group assignment */
  group: ToolbarGroup;
  /** Higher = more important = collapses last in overflow */
  priority: number;
  /**
   * ID of the command this action mirrors (full ID, e.g. "command-palette"
   * or "ext:sync:push"). When set, the command registry is the single source
   * of truth for the shortcut hint shown in tooltips, the overflow menu and
   * Toolbar settings -- see {@link resolveToolbarActionShortcut}.
   */
  commandId?: string;
  /**
   * Keyboard shortcut hint (react-hotkeys-hook format, e.g. "mod+o").
   * Only consulted for actions without a `commandId`; prefer linking a
   * command so the hint cannot drift from the command palette.
   */
  shortcut?: string;
  /** Visibility condition. Reads store .getState() at eval time (NOT closures) */
  when?: () => boolean;
  /** Action handler */
  execute: () => void | Promise<void>;
  /** Loading/pending state indicator */
  isLoading?: () => boolean;
  /** "core" for built-in, "ext:{extId}" for extensions */
  source?: string;
  /** Badge callback returning a count or label to overlay on the button */
  badge?: () => number | string | null;
  /** Optional custom render function. When provided, replaces the default ToolbarButton rendering.
   *  Receives the action and the computed tabIndex for roving tabindex integration. */
  renderCustom?: (action: ToolbarAction, tabIndex: number) => ReactNode;
}

// --- Store ---

export const useToolbarRegistry = createRegistry<ToolbarAction>({
  name: "toolbar-registry",
  withVisibilityTick: true,
});

// --- Standalone query functions ---

export function getGroupedToolbarActions(): Record<
  ToolbarGroup,
  ToolbarAction[]
> {
  const { items } = useToolbarRegistry.getState();
  const grouped: Record<ToolbarGroup, ToolbarAction[]> = {
    navigation: [],
    "git-actions": [],
    views: [],
    app: [],
  };

  for (const action of items.values()) {
    // Skip actions whose visibility condition returns false
    if (action.when?.() === false) continue;
    grouped[action.group].push(action);
  }

  // Sort each group by priority descending (higher priority first)
  for (const group of TOOLBAR_GROUP_ORDER) {
    grouped[group].sort((a, b) => b.priority - a.priority);
  }

  return grouped;
}

// --- Shortcut hints ---

type ShortcutSource = Pick<ToolbarAction, "commandId" | "shortcut">;

/**
 * Shortcut hint to display for a toolbar action.
 *
 * Actions linked to a command (`commandId`) always show the command's
 * registered shortcut, even when they also carry a legacy `shortcut` string,
 * so every surface (menu bar, command palette, toolbar) agrees. Unlinked
 * actions fall back to their own `shortcut`.
 */
export function resolveToolbarActionShortcut(
  action: ShortcutSource,
): string | undefined {
  if (action.commandId) return getCommandShortcut(action.commandId);
  return action.shortcut;
}

/** Reactive variant of {@link resolveToolbarActionShortcut}. */
export function useToolbarActionShortcut(
  action: ShortcutSource,
): string | undefined {
  const commandShortcut = useCommandShortcut(action.commandId);
  if (action.commandId) return commandShortcut;
  return action.shortcut;
}

// NOTE: Toolbar registry is NOT registered for reset — toolbar actions survive repo switches.
// Repo-specific actions use when() conditions to hide themselves, not deregistration.
