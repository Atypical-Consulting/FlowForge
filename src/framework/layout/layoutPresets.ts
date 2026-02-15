import type { LucideIcon } from "lucide-react";
import {
  FolderSearch,
  GitCommitHorizontal,
  LayoutGrid,
  Maximize2,
} from "lucide-react";

export interface LayoutPreset {
  id: PresetId;
  label: string;
  icon: LucideIcon;
  description: string;
  /** Panel id -> percentage size (0..100). Keys match Panel id props in RepositoryView. */
  layout: Record<string, number>;
  /** Which panels are visible in this preset (sidebar collapsed = not visible) */
  visiblePanels: string[];
}

export type PresetId = "review" | "commit" | "explore" | "focus";

export const DEFAULT_PRESET_ID: PresetId = "review";

export const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: "review",
    label: "Review",
    icon: LayoutGrid,
    description: "Balanced view for code review",
    layout: { sidebar: 20, blades: 80 },
    visiblePanels: ["sidebar", "blades"],
  },
  {
    id: "commit",
    label: "Commit",
    icon: GitCommitHorizontal,
    description: "Emphasize staging area for committing",
    layout: { sidebar: 30, blades: 70 },
    visiblePanels: ["sidebar", "blades"],
  },
  {
    id: "explore",
    label: "Explore",
    icon: FolderSearch,
    description: "Maximize blade area for browsing",
    layout: { sidebar: 15, blades: 85 },
    visiblePanels: ["sidebar", "blades"],
  },
  {
    id: "focus",
    label: "Focus",
    icon: Maximize2,
    description: "Full-screen blade area, sidebar hidden",
    layout: { sidebar: 0, blades: 100 },
    visiblePanels: ["blades"],
  },
];

/** Lookup a preset by ID. Returns undefined if not found. */
export function getPresetById(id: string): LayoutPreset | undefined {
  return LAYOUT_PRESETS.find((p) => p.id === id);
}
