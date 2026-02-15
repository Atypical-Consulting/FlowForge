import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
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
  /** Keyboard shortcut (react-hotkeys-hook format, e.g. "mod+o") */
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

export function getGroupedToolbarActions(): Record<ToolbarGroup, ToolbarAction[]> {
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

// NOTE: Toolbar registry is NOT registered for reset — toolbar actions survive repo switches.
// Repo-specific actions use when() conditions to hide themselves, not deregistration.
