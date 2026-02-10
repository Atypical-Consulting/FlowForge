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
  singleton?: boolean;
  renderTitleContent?: (props: TProps) => ReactNode;
  renderTrailing?: (props: TProps, ctx: BladeRenderContext) => ReactNode;
  /** "core" for built-in blades, "ext:{extensionId}" for extension blades */
  source?: string;
}

const registry = new Map<string, BladeRegistration<any>>();

export function registerBlade<TProps>(config: BladeRegistration<TProps>): void {
  registry.set(config.type, config);
}

/** Remove a single blade registration by type string. Returns true if it existed. */
export function unregisterBlade(type: string): boolean {
  return registry.delete(type);
}

/** Remove all blade registrations matching the given source (e.g. "ext:github"). */
export function unregisterBySource(source: string): void {
  for (const [type, reg] of registry) {
    if (reg.source === source) {
      registry.delete(type);
    }
  }
}

/**
 * Clear only core blade registrations, preserving extension registrations.
 * Used by HMR dispose to reset before re-registration of core blades.
 */
export function clearCoreRegistry(): void {
  for (const type of Array.from(registry.keys())) {
    if (!type.startsWith("ext:")) {
      registry.delete(type);
    }
  }
}

export function getBladeRegistration(
  type: string,
): BladeRegistration | undefined {
  return registry.get(type);
}

export function getAllBladeTypes(): string[] {
  return Array.from(registry.keys());
}

/** Check if a blade type is registered as singleton (only one instance allowed in stack). */
export function isSingletonBlade(type: string): boolean {
  return registry.get(type)?.singleton === true;
}
