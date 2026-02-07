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
  renderTitleContent?: (props: TProps) => ReactNode;
  renderTrailing?: (props: TProps, ctx: BladeRenderContext) => ReactNode;
}

const registry = new Map<BladeType, BladeRegistration<any>>();

export function registerBlade<TProps>(config: BladeRegistration<TProps>): void {
  if (import.meta.env.DEV && registry.has(config.type) && !import.meta.hot) {
    console.warn(`[BladeRegistry] Duplicate registration for "${config.type}"`);
  }
  registry.set(config.type, config);
}

export function getBladeRegistration(
  type: BladeType,
): BladeRegistration | undefined {
  return registry.get(type);
}

export function getAllBladeTypes(): BladeType[] {
  return Array.from(registry.keys());
}
