import type { CoreBladeType, BladePropsMap } from "./bladeTypes";
import { getBladeRegistration } from "./bladeRegistry";
import { getNavigationActor } from "./navigation/context";

/** Open a core blade with type-safe props */
export function openBlade<K extends CoreBladeType>(
  type: K,
  props: BladePropsMap[K],
  title?: string,
): void;
/** Open an extension blade with arbitrary props */
export function openBlade(
  type: string,
  props: Record<string, unknown>,
  title?: string,
): void;
export function openBlade(
  type: string,
  props: Record<string, unknown>,
  title?: string,
): void {
  const reg = getBladeRegistration(type);
  const resolvedTitle =
    title ??
    (typeof reg?.defaultTitle === "function"
      ? reg.defaultTitle(props as any)
      : reg?.defaultTitle ?? type);

  getNavigationActor().send({ type: "PUSH_BLADE", bladeType: type as any, title: resolvedTitle, props });
}
