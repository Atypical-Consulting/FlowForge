import type { BladeType, BladePropsMap } from "../stores/bladeTypes";
import { getBladeRegistration } from "./bladeRegistry";
import { useBladeStore } from "../stores/blades";

const SINGLETON_TYPES: BladeType[] = [
  "settings",
  "changelog",
  "gitflow-cheatsheet",
];

/** Open a blade from non-React contexts (command palette, keyboard shortcuts, etc.) */
export function openBlade<K extends BladeType>(
  type: K,
  props: BladePropsMap[K],
  title?: string,
): void {
  const store = useBladeStore.getState();

  // Singleton guard: don't push duplicates
  if (SINGLETON_TYPES.includes(type)) {
    if (store.bladeStack.some((b) => b.type === type)) return;
  }

  const reg = getBladeRegistration(type);
  const resolvedTitle =
    title ??
    (typeof reg?.defaultTitle === "function"
      ? reg.defaultTitle(props as any)
      : reg?.defaultTitle ?? type);

  store.pushBlade({ type, title: resolvedTitle, props });
}
