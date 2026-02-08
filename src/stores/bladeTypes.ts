import type { DiffSource } from "../components/blades/DiffBlade";

/**
 * Central map: blade type -> required props.
 *
 * TO ADD A NEW BLADE TYPE:
 * 1. Add an entry to this interface
 * 2. Create the component in src/components/blades/YourBlade.tsx
 * 3. Create src/components/blades/registrations/your-type.ts with registerBlade()
 * 4. If file-type-based: add mapping in src/lib/fileDispatch.ts
 *
 * The dev-mode exhaustiveness check will warn if step 3 is forgotten.
 */
export interface BladePropsMap {
  "staging-changes": Record<string, never>;
  "topology-graph": Record<string, never>;
  "commit-details": { oid: string };
  "diff": { source: DiffSource };
  "viewer-nupkg": { filePath: string };
  "viewer-image": { filePath: string; oid?: string };
  "viewer-markdown": { filePath: string };
  "viewer-3d": { filePath: string };
  "viewer-code": { filePath: string };
  "repo-browser": { path?: string };
  "settings": Record<string, never>;
  "changelog": Record<string, never>;
  "gitflow-cheatsheet": Record<string, never>;
  "init-repo": { directoryPath: string };
}

/** Derived from the map — single source of truth */
export type BladeType = keyof BladePropsMap;

/** A type-safe blade with discriminated props */
export type TypedBlade = {
  [K in BladeType]: {
    id: string;
    type: K;
    title: string;
    props: BladePropsMap[K];
  };
}[BladeType];
