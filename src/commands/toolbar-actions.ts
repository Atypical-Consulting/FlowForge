/**
 * Core toolbar action registrations.
 *
 * This file is a side-effect barrel — importing it registers all core toolbar
 * actions via useToolbarRegistry.getState().registerMany().
 *
 * All when() and execute() functions use .getState() to read fresh state at
 * evaluation time. They NEVER close over values.
 *
 * Import this file at app startup (e.g., from App.tsx or commands/index.ts).
 */

import { Channel } from "@tauri-apps/api/core";
import {
  ArrowDown,
  ArrowUp,
  CloudDownload,
  FileText,
  FolderOpen,
  FolderTree,
  GitBranch,
  GitFork,
  Palette,
  RefreshCw,
  Search,
  Settings,
  Undo2,
  X,
} from "lucide-react";
import { type SyncProgress, commands as tauriCommands } from "../bindings";
import { openBlade } from "../lib/bladeOpener";
import { queryClient } from "../lib/queryClient";
import type { ToolbarAction } from "../lib/toolbarRegistry";
import { useToolbarRegistry } from "../lib/toolbarRegistry";
import { useCommandPaletteStore } from "../stores/commandPalette";
import { useRepositoryStore } from "../stores/repository";
import { toast } from "../stores/toast";
import { useUndoStore } from "../stores/undo";

// --- Helpers ---

/** Shared repo-open condition for git-actions, views, and navigation groups. */
const whenRepoOpen = (): boolean =>
  !!useRepositoryStore.getState().repoStatus;

/** Shared repo-closed condition for clone action. */
const whenRepoNotOpen = (): boolean =>
  !useRepositoryStore.getState().repoStatus;

// Module-level loading flags for sync operations (fetch/pull/push).
// These are simple flags — Plan 02 toolbar rendering will call isLoading() to check.
let fetchLoading = false;
let pullLoading = false;
let pushLoading = false;

// --- Core Actions ---

const coreActions: ToolbarAction[] = [
  // ──────────────────────────────────────────────
  // App group
  // ──────────────────────────────────────────────

  {
    id: "tb:open-repo",
    label: "Open Repository",
    icon: FolderOpen,
    group: "app",
    priority: 100,
    shortcut: "mod+o",
    source: "core",
    execute: () => {
      document.dispatchEvent(new CustomEvent("open-repository-dialog"));
    },
  },

  {
    id: "tb:settings",
    label: "Settings",
    icon: Settings,
    group: "app",
    priority: 90,
    shortcut: "mod+,",
    source: "core",
    execute: () => {
      openBlade("settings", {} as Record<string, never>);
    },
  },

  {
    id: "tb:command-palette",
    label: "Command Palette",
    icon: Search,
    group: "app",
    priority: 80,
    shortcut: "mod+shift+P",
    source: "core",
    execute: () => {
      useCommandPaletteStore.getState().togglePalette();
    },
  },

  {
    id: "tb:theme-toggle",
    label: "Theme",
    icon: Palette,
    group: "app",
    priority: 70,
    source: "core",
    // No-op — the Toolbar renderer (Plan 02) will check for this ID
    // and render the <ThemeToggle /> widget instead of a standard button.
    execute: () => {},
  },

  // ──────────────────────────────────────────────
  // Git Actions group (all require open repo)
  // ──────────────────────────────────────────────

  {
    id: "tb:undo",
    label: "Undo",
    icon: Undo2,
    group: "git-actions",
    priority: 80,
    source: "core",
    when: () =>
      !!useRepositoryStore.getState().repoStatus &&
      !!useUndoStore.getState().undoInfo?.canUndo,
    isLoading: () => useUndoStore.getState().undoIsUndoing,
    execute: async () => {
      const { undoInfo, performUndo } = useUndoStore.getState();
      if (!undoInfo?.canUndo) return;

      const confirmed = window.confirm(
        `Are you sure you want to undo?\n\n${undoInfo.description}`,
      );

      if (confirmed) {
        const success = await performUndo();
        if (success) {
          queryClient.invalidateQueries({ queryKey: ["commitHistory"] });
          queryClient.invalidateQueries({ queryKey: ["stagingStatus"] });
          queryClient.invalidateQueries({ queryKey: ["repositoryStatus"] });
        }
      }
    },
  },

  {
    id: "tb:refresh-all",
    label: "Refresh All",
    icon: RefreshCw,
    group: "git-actions",
    priority: 70,
    source: "core",
    when: whenRepoOpen,
    isLoading: () => {
      const repoStore = useRepositoryStore.getState();
      return (
        repoStore.branchIsLoading ||
        repoStore.stashIsLoading ||
        repoStore.tagIsLoading
      );
    },
    execute: async () => {
      const store = useRepositoryStore.getState();
      await Promise.all([
        store.loadBranches(),
        store.loadStashes(),
        store.loadTags(),
        useUndoStore.getState().loadUndoInfo(),
      ]);
    },
  },

  {
    id: "tb:fetch",
    label: "Fetch",
    icon: CloudDownload,
    group: "git-actions",
    priority: 60,
    shortcut: "mod+shift+F",
    source: "core",
    when: whenRepoOpen,
    isLoading: () => fetchLoading,
    execute: async () => {
      fetchLoading = true;
      try {
        const channel = new Channel<SyncProgress>();
        await tauriCommands.fetchFromRemote("origin", channel);
        toast.success("Fetched from origin");
      } catch (error) {
        toast.error(`Fetch failed: ${String(error)}`);
      } finally {
        fetchLoading = false;
      }
    },
  },

  {
    id: "tb:pull",
    label: "Pull",
    icon: ArrowDown,
    group: "git-actions",
    priority: 50,
    shortcut: "mod+shift+L",
    source: "core",
    when: whenRepoOpen,
    isLoading: () => pullLoading,
    execute: async () => {
      pullLoading = true;
      try {
        const channel = new Channel<SyncProgress>();
        await tauriCommands.pullFromRemote("origin", channel);
        toast.success("Pulled from origin");
      } catch (error) {
        toast.error(`Pull failed: ${String(error)}`);
      } finally {
        pullLoading = false;
      }
    },
  },

  {
    id: "tb:push",
    label: "Push",
    icon: ArrowUp,
    group: "git-actions",
    priority: 40,
    shortcut: "mod+shift+U",
    source: "core",
    when: whenRepoOpen,
    isLoading: () => pushLoading,
    execute: async () => {
      pushLoading = true;
      try {
        const channel = new Channel<SyncProgress>();
        await tauriCommands.pushToRemote("origin", channel);
        toast.success("Pushed to origin");
      } catch (error) {
        toast.error(`Push failed: ${String(error)}`);
      } finally {
        pushLoading = false;
      }
    },
  },

  // ──────────────────────────────────────────────
  // Views group (all require open repo)
  // ──────────────────────────────────────────────

  {
    id: "tb:gitflow-guide",
    label: "Gitflow Guide",
    icon: GitBranch,
    group: "views",
    priority: 50,
    source: "core",
    when: whenRepoOpen,
    execute: () => {
      openBlade("gitflow-cheatsheet", {} as Record<string, never>);
    },
  },

  {
    id: "tb:repo-browser",
    label: "Browse Repository",
    icon: FolderTree,
    group: "views",
    priority: 40,
    source: "core",
    when: whenRepoOpen,
    execute: () => {
      openBlade("repo-browser", {} as Record<string, never>);
    },
  },

  {
    id: "tb:changelog",
    label: "Changelog",
    icon: FileText,
    group: "views",
    priority: 30,
    source: "core",
    when: whenRepoOpen,
    execute: () => {
      openBlade("changelog", {} as Record<string, never>);
    },
  },

  // ──────────────────────────────────────────────
  // Navigation group (context-dependent)
  // ──────────────────────────────────────────────

  {
    id: "tb:close-repo",
    label: "Close Repository",
    icon: X,
    group: "navigation",
    priority: 60,
    source: "core",
    when: whenRepoOpen,
    execute: () => {
      useRepositoryStore.getState().closeRepository();
    },
  },

  {
    id: "tb:reveal-in-finder",
    label: "Reveal in File Manager",
    icon: FolderOpen,
    group: "navigation",
    priority: 50,
    source: "core",
    when: whenRepoOpen,
    execute: async () => {
      try {
        const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
        await revealItemInDir(
          useRepositoryStore.getState().repoStatus!.repoPath,
        );
      } catch (e) {
        toast.error(
          `Failed to reveal: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    },
  },

  {
    id: "tb:clone-repo",
    label: "Clone Repository",
    icon: GitFork,
    group: "navigation",
    priority: 40,
    source: "core",
    when: whenRepoNotOpen,
    execute: () => {
      document.dispatchEvent(new CustomEvent("clone-repository-dialog"));
    },
  },
];

// --- Register all core actions in a single batch ---

useToolbarRegistry.getState().registerMany(coreActions);

// This file must be imported at app startup for side-effect registration.
// Add `import "./toolbar-actions";` to src/commands/index.ts or App.tsx.
