import type { LucideIcon } from "lucide-react";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

// --- Types ---

export type ContextMenuLocation =
  | "file-tree"
  | "branch-list"
  | "commit-list"
  | "stash-list"
  | "tag-list"
  | "diff-hunk"
  | "blade-tab";

/** A callback the row that opened the menu already owns (checkout, drop, ...). */
export type ContextMenuAction = () => void | Promise<void>;

export interface ContextMenuContext {
  location: ContextMenuLocation;
  branchName?: string;
  filePath?: string;
  commitOid?: string;
  stashIndex?: number;
  tagName?: string;
  /** True when the row is the currently checked-out branch. */
  isHead?: boolean;
  /** True when the branch is pinned in Quick Access. */
  isPinned?: boolean;
  /**
   * Handlers supplied by the row that opened the menu, keyed by action name
   * (e.g. "checkout", "drop"). Lets menu items reuse the exact same callbacks
   * the row's hover buttons invoke -- confirmation dialogs included -- instead
   * of re-implementing git logic inside the extension.
   */
  actions?: Record<string, ContextMenuAction | undefined>;
}

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  location: ContextMenuLocation;
  group?: string;
  priority?: number;
  when?: (ctx: ContextMenuContext) => boolean;
  execute: (ctx: ContextMenuContext) => void | Promise<void>;
  source?: string;
}

export interface ActiveMenu {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  context: ContextMenuContext;
}

// --- Store ---

export interface ContextMenuRegistryState {
  items: Map<string, ContextMenuItem>;
  activeMenu: ActiveMenu | null;
  register: (item: ContextMenuItem) => void;
  unregister: (id: string) => void;
  unregisterBySource: (source: string) => void;
  getItemsForLocation: (
    location: ContextMenuLocation,
    context: ContextMenuContext,
  ) => ContextMenuItem[];
  showMenu: (
    position: { x: number; y: number },
    location: ContextMenuLocation,
    context: ContextMenuContext,
  ) => void;
  hideMenu: () => void;
}

export const useContextMenuRegistry = create<ContextMenuRegistryState>()(
  devtools(
    (set, get) => ({
      items: new Map<string, ContextMenuItem>(),
      activeMenu: null,

      register: (item) => {
        const next = new Map(get().items);
        next.set(item.id, item);
        set({ items: next }, false, "context-menu-registry/register");
      },

      unregister: (id) => {
        const next = new Map(get().items);
        next.delete(id);
        set({ items: next }, false, "context-menu-registry/unregister");
      },

      unregisterBySource: (source) => {
        const next = new Map(get().items);
        for (const [id, item] of next) {
          if (item.source === source) {
            next.delete(id);
          }
        }
        set({ items: next }, false, "context-menu-registry/unregisterBySource");
      },

      getItemsForLocation: (location, context) => {
        const { items } = get();
        const filtered: ContextMenuItem[] = [];

        for (const item of items.values()) {
          if (item.location !== location) continue;
          if (item.when && !item.when(context)) continue;
          filtered.push(item);
        }

        // Sort by group alphabetically, then by priority descending within group
        filtered.sort((a, b) => {
          const groupA = a.group ?? "";
          const groupB = b.group ?? "";
          if (groupA !== groupB) return groupA.localeCompare(groupB);
          return (b.priority ?? 0) - (a.priority ?? 0);
        });

        return filtered;
      },

      showMenu: (position, location, context) => {
        const items = get().getItemsForLocation(location, context);
        if (items.length === 0) return;
        set(
          { activeMenu: { items, position, context } },
          false,
          "context-menu-registry/showMenu",
        );
      },

      hideMenu: () => {
        set({ activeMenu: null }, false, "context-menu-registry/hideMenu");
      },
    }),
    { name: "context-menu-registry", enabled: import.meta.env.DEV },
  ),
);
