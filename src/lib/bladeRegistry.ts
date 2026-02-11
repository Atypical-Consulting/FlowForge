import type { ComponentType, LazyExoticComponent, ReactNode } from "react";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

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

export interface BladeRegistryState {
  blades: Map<string, BladeRegistration<any>>;
  register: (config: BladeRegistration<any>) => void;
  unregister: (type: string) => boolean;
  unregisterBySource: (source: string) => void;
  clearCoreRegistrations: () => void;
  getRegistration: (type: string) => BladeRegistration<any> | undefined;
  getAllTypes: () => string[];
  isSingleton: (type: string) => boolean;
}

export const useBladeRegistry = create<BladeRegistryState>()(
  devtools(
    (set, get) => ({
      blades: new Map<string, BladeRegistration<any>>(),

      register: (config) => {
        const next = new Map(get().blades);
        next.set(config.type, config);
        set({ blades: next }, false, "blade-registry/register");
      },

      unregister: (type) => {
        const prev = get().blades;
        if (!prev.has(type)) return false;
        const next = new Map(prev);
        next.delete(type);
        set({ blades: next }, false, "blade-registry/unregister");
        return true;
      },

      unregisterBySource: (source) => {
        const next = new Map(get().blades);
        for (const [type, reg] of next) {
          if (reg.source === source) {
            next.delete(type);
          }
        }
        set({ blades: next }, false, "blade-registry/unregisterBySource");
      },

      clearCoreRegistrations: () => {
        const next = new Map(get().blades);
        for (const type of Array.from(next.keys())) {
          if (!type.startsWith("ext:")) {
            next.delete(type);
          }
        }
        set(
          { blades: next },
          false,
          "blade-registry/clearCoreRegistrations",
        );
      },

      getRegistration: (type) => {
        return get().blades.get(type);
      },

      getAllTypes: () => {
        return Array.from(get().blades.keys());
      },

      isSingleton: (type) => {
        return get().blades.get(type)?.singleton === true;
      },
    }),
    { name: "blade-registry", enabled: import.meta.env.DEV },
  ),
);

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
  return useBladeRegistry.getState().getRegistration(type);
}

export function getAllBladeTypes(): string[] {
  return useBladeRegistry.getState().getAllTypes();
}

/** Check if a blade type is registered as singleton (only one instance allowed in stack). */
export function isSingletonBlade(type: string): boolean {
  return useBladeRegistry.getState().isSingleton(type);
}
