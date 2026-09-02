import type { LucideIcon } from "lucide-react";
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
  SquarePen,
  Sun,
  X,
} from "lucide-react";

export interface MenuItemDef {
  type: "action";
  id: string;
  label: string;
  icon?: LucideIcon;
  /**
   * Command this entry executes. Its registered shortcut is the hint shown
   * next to the label -- menus never hard-code shortcut strings.
   */
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
        commandId: "ext:init-repo:init-repository",
      },
      {
        type: "action",
        id: "file-open-repo",
        label: "Open Repository...",
        icon: FolderOpen,
        commandId: "ext:repository:open-repository",
      },
      {
        type: "action",
        id: "file-clone-repo",
        label: "Clone Repository...",
        icon: GitFork,
        commandId: "ext:repository:clone-repository",
      },
      { type: "divider", id: "file-div-1" },
      {
        type: "action",
        id: "file-close-repo",
        label: "Close Repository",
        icon: X,
        commandId: "ext:repository:close-repository",
      },
      { type: "divider", id: "file-div-2" },
      {
        type: "action",
        id: "file-settings",
        label: "Preferences...",
        icon: Settings,
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
        commandId: "show-changes",
      },
      {
        type: "action",
        id: "view-history",
        label: "History",
        icon: History,
        commandId: "show-history",
      },
      {
        type: "action",
        id: "view-branches",
        label: "Show Branches",
        icon: GitBranch,
        commandId: "ext:branches:show-branches",
      },
      { type: "divider", id: "view-div-1" },
      {
        type: "action",
        id: "view-command-palette",
        label: "Command Palette",
        icon: Search,
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
        id: "view-layout-compose",
        label: "Layout: Compose",
        icon: SquarePen,
        commandId: "layout-preset-compose",
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
        commandId: "ext:sync:fetch",
      },
      {
        type: "action",
        id: "repo-pull",
        label: "Pull",
        icon: ArrowDown,
        commandId: "ext:sync:pull",
      },
      {
        type: "action",
        id: "repo-push",
        label: "Push",
        icon: ArrowUp,
        commandId: "ext:sync:push",
      },
      { type: "divider", id: "repo-div-1" },
      {
        type: "action",
        id: "repo-stage-all",
        label: "Stage All",
        icon: FileCheck,
        commandId: "ext:sync:stage-all",
      },
      {
        type: "action",
        id: "repo-toggle-amend",
        label: "Toggle Amend",
        icon: RotateCcw,
        commandId: "ext:sync:toggle-amend",
      },
      { type: "divider", id: "repo-div-2" },
      {
        type: "action",
        id: "repo-refresh",
        label: "Refresh All",
        icon: RefreshCw,
        commandId: "ext:repository:refresh-all",
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
        commandId: "ext:branches:create-branch",
      },
    ],
  },
];
