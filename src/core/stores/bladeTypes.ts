import type { DiffSource } from "@/extensions/diff/blades";

/**
 * Central map: blade type -> required props.
 *
 * TO ADD A NEW BLADE TYPE:
 * 1. Add an entry to this interface
 * 2. Create src/blades/your-type/ with YourBlade.tsx
 * 3. Create src/blades/your-type/registration.ts with registerBlade()
 * 4. If file-type-based: add mapping in src/lib/fileDispatch.ts
 *
 * The dev-mode exhaustiveness check will warn if step 3 is forgotten.
 */
export interface BladePropsMap {
  "staging-changes": Record<string, never>;
  "topology-graph": Record<string, never>;
  "commit-list-fallback": Record<string, never>;
  "commit-details": { oid: string };
  "diff": { source: DiffSource };
  "viewer-nupkg": { filePath: string };
  "viewer-image": { filePath: string; oid?: string };
  "viewer-markdown": { filePath: string };
  "viewer-3d": { filePath: string };
  "viewer-code": { filePath: string };
  "viewer-plaintext": { filePath: string };
  "branch-manager": Record<string, never>;
  "repo-browser": { path?: string };
  "settings": Record<string, never>;
  "changelog": Record<string, never>;
  "gitflow-cheatsheet": Record<string, never>;
  "init-repo": { directoryPath: string };
  "conventional-commit": { amend?: boolean };
  "extension-manager": Record<string, never>;
  "extension-detail": { extensionId: string };
  "welcome-screen": Record<string, never>;
}

/** Core blade types derived from the map — single source of truth */
export type CoreBladeType = keyof BladePropsMap;

/** Extension blade types follow the ext:{extensionId}:{bladeName} convention */
export type ExtensionBladeType = `ext:${string}:${string}`;

/** Widened union: core blades + dynamic extension blades */
export type BladeType = CoreBladeType | ExtensionBladeType;

/** Runtime type guard: returns true for core blade types (not extension types) */
export function isCoreBladeType(type: BladeType): type is CoreBladeType {
  return !type.startsWith("ext:");
}

/** A type-safe blade with discriminated props */
export type TypedBlade =
  | {
      [K in CoreBladeType]: {
        id: string;
        type: K;
        title: string;
        props: BladePropsMap[K];
      };
    }[CoreBladeType]
  | { id: string; type: ExtensionBladeType; title: string; props: Record<string, unknown> };
