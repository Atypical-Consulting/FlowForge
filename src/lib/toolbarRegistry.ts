import type { LucideIcon } from "lucide-react";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

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
}

// --- Store ---

export interface ToolbarRegistryState {
  actions: Map<string, ToolbarAction>;
  register: (action: ToolbarAction) => void;
  registerMany: (actions: ToolbarAction[]) => void;
  unregister: (id: string) => void;
  unregisterBySource: (source: string) => void;
  getGrouped: () => Record<ToolbarGroup, ToolbarAction[]>;
}

export const useToolbarRegistry = create<ToolbarRegistryState>()(
  devtools(
    (set, get) => ({
      actions: new Map<string, ToolbarAction>(),

      register: (action) => {
        const next = new Map(get().actions);
        next.set(action.id, action);
        set({ actions: next }, false, "toolbar-registry/register");
      },

      registerMany: (actions) => {
        const next = new Map(get().actions);
        for (const action of actions) {
          next.set(action.id, action);
        }
        set({ actions: next }, false, "toolbar-registry/registerMany");
      },

      unregister: (id) => {
        const next = new Map(get().actions);
        next.delete(id);
        set({ actions: next }, false, "toolbar-registry/unregister");
      },

      unregisterBySource: (source) => {
        const next = new Map(get().actions);
        for (const [id, action] of next) {
          if (action.source === source) {
            next.delete(id);
          }
        }
        set({ actions: next }, false, "toolbar-registry/unregisterBySource");
      },

      getGrouped: () => {
        const { actions } = get();
        const grouped: Record<ToolbarGroup, ToolbarAction[]> = {
          navigation: [],
          "git-actions": [],
          views: [],
          app: [],
        };

        for (const action of actions.values()) {
          // Skip actions whose visibility condition returns false
          if (action.when?.() === false) continue;
          grouped[action.group].push(action);
        }

        // Sort each group by priority descending (higher priority first)
        for (const group of TOOLBAR_GROUP_ORDER) {
          grouped[group].sort((a, b) => b.priority - a.priority);
        }

        return grouped;
      },
    }),
    { name: "toolbar-registry", enabled: import.meta.env.DEV },
  ),
);

// NOTE: Toolbar registry is NOT registered for reset — toolbar actions survive repo switches.
// Repo-specific actions use when() conditions to hide themselves, not deregistration.
