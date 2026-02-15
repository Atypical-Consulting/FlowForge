import type { ReactNode } from "react";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

// --- Types ---

export type StatusBarAlignment = "left" | "right";

export interface StatusBarItem {
  id: string;
  alignment: StatusBarAlignment;
  priority: number;
  renderCustom: () => ReactNode;
  when?: () => boolean;
  execute?: () => void | Promise<void>;
  tooltip?: string;
  source?: string;
}

// --- Store ---

export interface StatusBarRegistryState {
  items: Map<string, StatusBarItem>;
  visibilityTick: number;
  register: (item: StatusBarItem) => void;
  unregister: (id: string) => void;
  unregisterBySource: (source: string) => void;
  refreshVisibility: () => void;
  getLeftItems: () => StatusBarItem[];
  getRightItems: () => StatusBarItem[];
}

export const useStatusBarRegistry = create<StatusBarRegistryState>()(
  devtools(
    (set, get) => ({
      items: new Map<string, StatusBarItem>(),
      visibilityTick: 0,

      register: (item) => {
        const next = new Map(get().items);
        next.set(item.id, item);
        set({ items: next }, false, "status-bar-registry/register");
      },

      unregister: (id) => {
        const next = new Map(get().items);
        next.delete(id);
        set({ items: next }, false, "status-bar-registry/unregister");
      },

      unregisterBySource: (source) => {
        const next = new Map(get().items);
        for (const [id, item] of next) {
          if (item.source === source) {
            next.delete(id);
          }
        }
        set(
          { items: next },
          false,
          "status-bar-registry/unregisterBySource",
        );
      },

      refreshVisibility: () => {
        set(
          { visibilityTick: get().visibilityTick + 1 },
          false,
          "status-bar-registry/refreshVisibility",
        );
      },

      getLeftItems: () => {
        const { items } = get();
        const left: StatusBarItem[] = [];

        for (const item of items.values()) {
          if (item.alignment !== "left") continue;
          if (item.when !== undefined && !item.when()) continue;
          left.push(item);
        }

        left.sort((a, b) => b.priority - a.priority);
        return left;
      },

      getRightItems: () => {
        const { items } = get();
        const right: StatusBarItem[] = [];

        for (const item of items.values()) {
          if (item.alignment !== "right") continue;
          if (item.when !== undefined && !item.when()) continue;
          right.push(item);
        }

        right.sort((a, b) => b.priority - a.priority);
        return right;
      },
    }),
    { name: "status-bar-registry", enabled: import.meta.env.DEV },
  ),
);
