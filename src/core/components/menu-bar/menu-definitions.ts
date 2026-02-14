import {
  ArrowDown,
  ArrowUp,
  CloudDownload,
  FileCheck,
  FileText,
  FolderOpen,
  FolderPlus,
  FolderSearch,
  GitBranch,
  GitCommitHorizontal,
  GitFork,
  History,
  LayoutGrid,
  Maximize2,
  PanelLeft,
  Puzzle,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Sun,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface MenuItemDef {
  type: "action";
  id: string;
  label: string;
  icon?: LucideIcon;
  shortcut?: string;
  commandId: string;
}

export interface MenuDividerDef {
  type: "divider";
  id: string;
}

export type MenuEntryDef = MenuItemDef | MenuDividerDef;

export interface MenuDef {
  id: string;
  label: string;
  items: MenuEntryDef[];
}

export const menuDefinitions: MenuDef[] = [
  {
    id: "file",
    label: "File",
    items: [
      {
        type: "action",
        id: "file-new-repo",
        label: "New Repository...",
        icon: FolderPlus,
        shortcut: "mod+n",
        commandId: "ext:init-repo:init-repository",
      },
      {
        type: "action",
        id: "file-open-repo",
        label: "Open Repository...",
        icon: FolderOpen,
        shortcut: "mod+o",
        commandId: "open-repository",
      },
      {
        type: "action",
        id: "file-clone-repo",
        label: "Clone Repository...",
        icon: GitFork,
        shortcut: "mod+shift+o",
        commandId: "clone-repository",
      },
      { type: "divider", id: "file-div-1" },
      {
        type: "action",
        id: "file-close-repo",
        label: "Close Repository",
        icon: X,
        commandId: "close-repository",
      },
      { type: "divider", id: "file-div-2" },
      {
        type: "action",
        id: "file-settings",
        label: "Preferences...",
        icon: Settings,
        shortcut: "mod+,",
        commandId: "open-settings",
      },
    ],
  },
  {
    id: "view",
    label: "View",
    items: [
      {
        type: "action",
        id: "view-changes",
        label: "Changes",
        icon: FileText,
        shortcut: "mod+1",
        commandId: "show-changes",
      },
      {
        type: "action",
        id: "view-history",
        label: "History",
        icon: History,
        shortcut: "mod+2",
        commandId: "show-history",
      },
      {
        type: "action",
        id: "view-branches",
        label: "Show Branches",
        icon: GitBranch,
        shortcut: "mod+b",
        commandId: "show-branches",
      },
      { type: "divider", id: "view-div-1" },
      {
        type: "action",
        id: "view-command-palette",
        label: "Command Palette",
        icon: Search,
        shortcut: "mod+k",
        commandId: "command-palette",
      },
      {
        type: "action",
        id: "view-theme",
        label: "Toggle Theme",
        icon: Sun,
        commandId: "toggle-theme",
      },
      {
        type: "action",
        id: "view-extensions",
        label: "Extension Manager",
        icon: Puzzle,
        commandId: "open-extension-manager",
      },
      { type: "divider", id: "view-div-layout" },
      {
        type: "action",
        id: "view-layout-review",
        label: "Layout: Review",
        icon: LayoutGrid,
        commandId: "layout-preset-review",
      },
      {
        type: "action",
        id: "view-layout-commit",
        label: "Layout: Commit",
        icon: GitCommitHorizontal,
        commandId: "layout-preset-commit",
      },
      {
        type: "action",
        id: "view-layout-explore",
        label: "Layout: Explore",
        icon: FolderSearch,
        commandId: "layout-preset-explore",
      },
      {
        type: "action",
        id: "view-layout-focus",
        label: "Layout: Focus",
        icon: Maximize2,
        commandId: "layout-preset-focus",
      },
      { type: "divider", id: "view-div-panels" },
      {
        type: "action",
        id: "view-toggle-sidebar",
        label: "Toggle Sidebar",
        icon: PanelLeft,
        shortcut: "mod+\\",
        commandId: "toggle-sidebar",
      },
      {
        type: "action",
        id: "view-reset-layout",
        label: "Reset Layout",
        icon: RotateCcw,
        commandId: "reset-layout",
      },
    ],
  },
  {
    id: "repository",
    label: "Repository",
    items: [
      {
        type: "action",
        id: "repo-fetch",
        label: "Fetch",
        icon: CloudDownload,
        shortcut: "mod+shift+f",
        commandId: "fetch",
      },
      {
        type: "action",
        id: "repo-pull",
        label: "Pull",
        icon: ArrowDown,
        shortcut: "mod+shift+l",
        commandId: "pull",
      },
      {
        type: "action",
        id: "repo-push",
        label: "Push",
        icon: ArrowUp,
        shortcut: "mod+shift+u",
        commandId: "push",
      },
      { type: "divider", id: "repo-div-1" },
      {
        type: "action",
        id: "repo-stage-all",
        label: "Stage All",
        icon: FileCheck,
        shortcut: "mod+shift+a",
        commandId: "stage-all",
      },
      {
        type: "action",
        id: "repo-toggle-amend",
        label: "Toggle Amend",
        icon: RotateCcw,
        shortcut: "mod+shift+m",
        commandId: "toggle-amend",
      },
      { type: "divider", id: "repo-div-2" },
      {
        type: "action",
        id: "repo-refresh",
        label: "Refresh All",
        icon: RefreshCw,
        commandId: "refresh-all",
      },
    ],
  },
  {
    id: "branch",
    label: "Branch",
    items: [
      {
        type: "action",
        id: "branch-new",
        label: "New Branch...",
        icon: GitBranch,
        shortcut: "mod+shift+n",
        commandId: "create-branch",
      },
    ],
  },
];
