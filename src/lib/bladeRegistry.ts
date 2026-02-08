import type { ComponentType, LazyExoticComponent, ReactNode } from "react";
import type { BladeType } from "../stores/bladeTypes";

export interface BladeRenderContext {
  goBack: () => void;
}

export interface BladeRegistration<TProps = Record<string, never>> {
  type: BladeType;
  defaultTitle: string | ((props: TProps) => string);
  component: ComponentType<TProps> | LazyExoticComponent<ComponentType<TProps>>;
  lazy?: boolean;
  wrapInPanel?: boolean;
  showBack?: boolean;
  singleton?: boolean;
  renderTitleContent?: (props: TProps) => ReactNode;
  renderTrailing?: (props: TProps, ctx: BladeRenderContext) => ReactNode;
}

const registry = new Map<BladeType, BladeRegistration<any>>();

export function registerBlade<TProps>(config: BladeRegistration<TProps>): void {
  registry.set(config.type, config);
}

/** Clear all registrations. Used by HMR dispose to reset before re-registration. */
export function clearRegistry(): void {
  registry.clear();
}

export function getBladeRegistration(
  type: BladeType,
): BladeRegistration | undefined {
  return registry.get(type);
}

export function getAllBladeTypes(): BladeType[] {
  return Array.from(registry.keys());
}

/** Check if a blade type is registered as singleton (only one instance allowed in stack). */
export function isSingletonBlade(type: BladeType): boolean {
  return registry.get(type)?.singleton === true;
}
