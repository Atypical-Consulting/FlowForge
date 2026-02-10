import type { ComponentType, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

// --- Types ---

export interface SidebarPanelConfig {
  id: string;
  title: string;
  icon: LucideIcon;
  component: ComponentType<any>;
  priority: number;
  when?: () => boolean;
  defaultOpen?: boolean;
  source?: string;
  renderAction?: () => ReactNode;
}

// --- Store ---

export interface SidebarPanelRegistryState {
  panels: Map<string, SidebarPanelConfig>;
  visibilityTick: number;
  register: (panel: SidebarPanelConfig) => void;
  unregister: (id: string) => void;
  unregisterBySource: (source: string) => void;
  refreshVisibility: () => void;
  getVisiblePanels: () => SidebarPanelConfig[];
}

export const useSidebarPanelRegistry = create<SidebarPanelRegistryState>()(
  devtools(
    (set, get) => ({
      panels: new Map<string, SidebarPanelConfig>(),
      visibilityTick: 0,

      register: (panel) => {
        const next = new Map(get().panels);
        next.set(panel.id, panel);
        set({ panels: next }, false, "sidebar-panel-registry/register");
      },

      unregister: (id) => {
        const next = new Map(get().panels);
        next.delete(id);
        set({ panels: next }, false, "sidebar-panel-registry/unregister");
      },

      unregisterBySource: (source) => {
        const next = new Map(get().panels);
        for (const [id, panel] of next) {
          if (panel.source === source) {
            next.delete(id);
          }
        }
        set(
          { panels: next },
          false,
          "sidebar-panel-registry/unregisterBySource",
        );
      },

      refreshVisibility: () => {
        set(
          { visibilityTick: get().visibilityTick + 1 },
          false,
          "sidebar-panel-registry/refreshVisibility",
        );
      },

      getVisiblePanels: () => {
        const { panels } = get();
        const visible: SidebarPanelConfig[] = [];

        for (const panel of panels.values()) {
          if (panel.when !== undefined && !panel.when()) continue;
          visible.push(panel);
        }

        // Sort by priority descending, then alphabetically by id for tiebreaking
        visible.sort((a, b) => {
          if (b.priority !== a.priority) return b.priority - a.priority;
          return a.id.localeCompare(b.id);
        });

        return visible;
      },
    }),
    { name: "sidebar-panel-registry", enabled: import.meta.env.DEV },
  ),
);
