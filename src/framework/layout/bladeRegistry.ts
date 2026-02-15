import type { ComponentType, LazyExoticComponent, ReactNode } from "react";
import { createRegistry } from "../stores/createRegistry";

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

// --- Store ---

export const useBladeRegistry = createRegistry<BladeRegistration<any>>({
  name: "blade-registry",
  getKey: (b) => b.type,
});

// --- Standalone query functions ---

export function getRegistration(type: string): BladeRegistration<any> | undefined {
  return useBladeRegistry.getState().get(type);
}

export function getAllTypes(): string[] {
  return Array.from(useBladeRegistry.getState().items.keys());
}

export function isSingleton(type: string): boolean {
  return useBladeRegistry.getState().get(type)?.singleton === true;
}

// --- Backward-compatible function exports ---
// All 26 consumer files continue importing these same functions unchanged.

export function registerBlade<TProps>(
  config: BladeRegistration<TProps>,
): void {
  useBladeRegistry.getState().register(config);
}

/** Remove a single blade registration by type string. Returns true if it existed. */
export function unregisterBlade(type: string): boolean {
  return useBladeRegistry.getState().unregister(type);
}

/** Remove all blade registrations matching the given source (e.g. "ext:github"). */
export function unregisterBySource(source: string): void {
  useBladeRegistry.getState().unregisterBySource(source);
}

/**
 * Clear only core blade registrations, preserving extension registrations.
 * Used by HMR dispose to reset before re-registration of core blades.
 */
export function clearCoreRegistry(): void {
  useBladeRegistry.getState().clearCoreRegistrations();
}

export function getBladeRegistration(
  type: string,
): BladeRegistration | undefined {
  return useBladeRegistry.getState().get(type);
}

export function getAllBladeTypes(): string[] {
  return Array.from(useBladeRegistry.getState().items.keys());
}

/** Check if a blade type is registered as singleton (only one instance allowed in stack). */
export function isSingletonBlade(type: string): boolean {
  return useBladeRegistry.getState().get(type)?.singleton === true;
}
