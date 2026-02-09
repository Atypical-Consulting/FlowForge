import type { ComponentType } from "react";
import type { FileChange } from "../bindings";
import type { DiffSource } from "../blades/diff";

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
}

const registry: PreviewRegistration[] = [];

export function registerPreview(config: PreviewRegistration): void {
  registry.push(config);
  registry.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

export function getPreviewForFile(
  filePath: string,
): PreviewRegistration | undefined {
  return registry.find((r) => r.matches(filePath));
}
