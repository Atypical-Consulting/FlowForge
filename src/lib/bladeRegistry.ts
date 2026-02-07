import type { ComponentType, LazyExoticComponent, ReactNode } from "react";

export interface BladeRenderContext {
  goBack: () => void;
}

export interface BladeRegistration<TProps = Record<string, never>> {
  type: string;
  defaultTitle: string | ((props: TProps) => string);
  component: ComponentType<TProps> | LazyExoticComponent<ComponentType<TProps>>;
  lazy?: boolean;
  wrapInPanel?: boolean;
  showBack?: boolean;
  renderTitleContent?: (props: TProps) => ReactNode;
  renderTrailing?: (props: TProps, ctx: BladeRenderContext) => ReactNode;
}

const registry = new Map<string, BladeRegistration<any>>();

export function registerBlade<TProps>(config: BladeRegistration<TProps>): void {
  registry.set(config.type, config);
}

export function getBladeRegistration(
  type: string,
): BladeRegistration | undefined {
  return registry.get(type);
}

export function getAllBladeTypes(): string[] {
  return Array.from(registry.keys());
}
