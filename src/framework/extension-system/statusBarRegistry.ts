import type { ReactNode } from "react";
import { createRegistry } from "../stores/createRegistry";

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

export const useStatusBarRegistry = createRegistry<StatusBarItem>({
  name: "status-bar-registry",
  withVisibilityTick: true,
});

// --- Standalone query functions ---

export function getLeftItems(): StatusBarItem[] {
  const { items } = useStatusBarRegistry.getState();
  const left: StatusBarItem[] = [];

  for (const item of items.values()) {
    if (item.alignment !== "left") continue;
    if (item.when !== undefined && !item.when()) continue;
    left.push(item);
  }

  left.sort((a, b) => b.priority - a.priority);
  return left;
}

export function getRightItems(): StatusBarItem[] {
  const { items } = useStatusBarRegistry.getState();
  const right: StatusBarItem[] = [];

  for (const item of items.values()) {
    if (item.alignment !== "right") continue;
    if (item.when !== undefined && !item.when()) continue;
    right.push(item);
  }

  right.sort((a, b) => b.priority - a.priority);
  return right;
}
