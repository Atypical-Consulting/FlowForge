import type { BladeType, BladePropsMap } from "../stores/bladeTypes";
import { getBladeRegistration } from "./bladeRegistry";
import { getNavigationActor } from "../machines/navigation/context";

/** Open a blade from non-React contexts (command palette, keyboard shortcuts, etc.) */
export function openBlade<K extends BladeType>(
  type: K,
  props: BladePropsMap[K],
  title?: string,
): void {
  const reg = getBladeRegistration(type);
  const resolvedTitle =
    title ??
    (typeof reg?.defaultTitle === "function"
      ? reg.defaultTitle(props as any)
      : reg?.defaultTitle ?? type);

  getNavigationActor().send({ type: "PUSH_BLADE", bladeType: type, title: resolvedTitle, props });
}
