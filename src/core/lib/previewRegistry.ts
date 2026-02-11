import type { ComponentType } from "react";
import type { FileChange } from "../bindings";
import type { DiffSource } from "../blades/diff";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

export type PreviewMode = "inline-diff" | "placeholder" | "custom";

export interface PreviewRegistration {
  key: string;
  matches: (filePath: string) => boolean;
  mode: PreviewMode;
  placeholder?: {
    icon: ComponentType<{ className?: string }>;
    message: string;
  };
  component?: ComponentType<{ file: FileChange; source: DiffSource }>;
  priority?: number;
  /** "core" for built-in, "ext:{extensionId}" for extensions */
  source?: string;
}

// --- Store ---

export interface PreviewRegistryState {
  previews: PreviewRegistration[];
  register: (config: PreviewRegistration) => void;
  unregister: (key: string) => boolean;
  unregisterBySource: (source: string) => void;
  getForFile: (filePath: string) => PreviewRegistration | undefined;
}

export const usePreviewRegistry = create<PreviewRegistryState>()(
  devtools(
    (set, get) => ({
      previews: [] as PreviewRegistration[],

      register: (config) => {
        const next = [
          ...get().previews,
          { ...config, source: config.source ?? "core" },
        ];
        next.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
        set({ previews: next }, false, "preview-registry/register");
      },

      unregister: (key) => {
        const prev = get().previews;
        const next = prev.filter((r) => r.key !== key);
        if (next.length === prev.length) return false;
        set({ previews: next }, false, "preview-registry/unregister");
        return true;
      },

      unregisterBySource: (source) => {
        const next = get().previews.filter((r) => r.source !== source);
        set(
          { previews: next },
          false,
          "preview-registry/unregisterBySource",
        );
      },

      getForFile: (filePath) => {
        return get().previews.find((r) => r.matches(filePath));
      },
    }),
    { name: "preview-registry", enabled: import.meta.env.DEV },
  ),
);

// --- Backward-compatible function exports ---

export function registerPreview(config: PreviewRegistration): void {
  usePreviewRegistry.getState().register(config);
}

export function getPreviewForFile(
  filePath: string,
): PreviewRegistration | undefined {
  return usePreviewRegistry.getState().getForFile(filePath);
}
