import type { DiffSource } from "@/extensions/diff/blades";

/**
 * Domain-specific blade type augmentation.
 *
 * This file augments the framework's generic BladePropsMap with
 * all the concrete blade types used by the FlowForge application.
 *
 * TO ADD A NEW BLADE TYPE:
 * 1. Add an entry to the augmented BladePropsMap below
 * 2. Create src/blades/your-type/ with YourBlade.tsx
 * 3. Create src/blades/your-type/registration.ts with registerBlade()
 * 4. If file-type-based: add mapping in src/lib/fileDispatch.ts
 */
declare module "@/framework/layout/bladeTypes" {
  interface BladePropsMap {
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
}

// Re-export for backward compatibility
export type {
  BladePropsMap,
  CoreBladeType,
  ExtensionBladeType,
  BladeType,
  TypedBlade,
} from "@/framework/layout/bladeTypes";
export { isCoreBladeType } from "@/framework/layout/bladeTypes";
