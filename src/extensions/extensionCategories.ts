import type { ExtensionInfo } from "./extensionTypes";

export type ExtensionCategory =
  | "source-control"
  | "viewers"
  | "integration"
  | "workflow"
  | "setup";

interface CategoryMeta {
  label: string;
  order: number;
}

export const CATEGORY_META: Record<ExtensionCategory, CategoryMeta> = {
  "source-control": { label: "Source Control", order: 1 },
  viewers: { label: "Viewers", order: 2 },
  integration: { label: "Integration", order: 3 },
  workflow: { label: "Workflow", order: 4 },
  setup: { label: "Setup", order: 5 },
};

const EXTENSION_CATEGORIES: Record<string, ExtensionCategory> = {
  "conventional-commits": "source-control",
  gitflow: "workflow",
  github: "integration",
  "init-repo": "setup",
  "viewer-3d": "viewers",
  "viewer-code": "viewers",
  "viewer-image": "viewers",
  "viewer-markdown": "viewers",
  "viewer-nupkg": "viewers",
  "viewer-plaintext": "viewers",
  "welcome-screen": "setup",
  worktrees: "source-control",
};

export function getExtensionCategory(extensionId: string): ExtensionCategory {
  return EXTENSION_CATEGORIES[extensionId] ?? "workflow";
}

export function getCategoryMeta(category: ExtensionCategory): CategoryMeta {
  return CATEGORY_META[category];
}

export function groupExtensionsByCategory(
  extensions: ExtensionInfo[],
): Map<ExtensionCategory, ExtensionInfo[]> {
  const groups = new Map<ExtensionCategory, ExtensionInfo[]>();

  for (const ext of extensions) {
    const cat = getExtensionCategory(ext.id);
    const list = groups.get(cat) ?? [];
    list.push(ext);
    groups.set(cat, list);
  }

  // Sort categories by order, extensions within each alphabetically
  const sorted = new Map<ExtensionCategory, ExtensionInfo[]>();
  const entries = Array.from(groups.entries()).sort(
    ([a], [b]) => CATEGORY_META[a].order - CATEGORY_META[b].order,
  );

  for (const [cat, exts] of entries) {
    sorted.set(
      cat,
      exts.sort((a, b) => a.name.localeCompare(b.name)),
    );
  }

  return sorted;
}
