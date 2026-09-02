import type { LucideIcon } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { createRegistry } from "../stores/createRegistry";

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
  /** Header action (e.g. a "+" button). Clicking it never toggles the panel. */
  renderAction?: () => ReactNode;
  /**
   * Count shown in the panel header. Invoked during render of the header, so it
   * may be a hook (e.g. `() => useStore((s) => s.items.length)`) to stay
   * reactive. `0` is displayed; return `null` to hide the badge.
   */
  badge?: () => number | string | null;
}

// --- Store ---

export const useSidebarPanelRegistry = createRegistry<SidebarPanelConfig>({
  name: "sidebar-panel-registry",
  withVisibilityTick: true,
});

// --- Standalone query functions ---

export function getVisiblePanels(): SidebarPanelConfig[] {
  const { items } = useSidebarPanelRegistry.getState();
  const visible: SidebarPanelConfig[] = [];

  for (const panel of items.values()) {
    if (panel.when !== undefined && !panel.when()) continue;
    visible.push(panel);
  }

  // Sort by priority descending, then alphabetically by id for tiebreaking
  visible.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.id.localeCompare(b.id);
  });

  return visible;
}
