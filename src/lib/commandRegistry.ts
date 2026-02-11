import type { LucideIcon } from "lucide-react";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

/** Core command categories with known ordering */
export type CoreCommandCategory =
  | "Repository"
  | "Branches"
  | "Sync"
  | "Stash"
  | "Tags"
  | "Worktrees"
  | "Navigation"
  | "Settings";

/** Widened category type: core categories + any extension string (preserves autocompletion) */
export type CommandCategory = CoreCommandCategory | (string & {});

export interface Command {
  id: string;
  title: string;
  description?: string;
  category: CommandCategory;
  shortcut?: string;
  icon?: LucideIcon;
  action: () => void | Promise<void>;
  enabled?: () => boolean;
  keywords?: string[];
  /** "core" for built-in commands, "ext:{extensionId}" for extension commands */
  source?: string;
}

/** Canonical ordering for core categories */
const CORE_ORDER: CoreCommandCategory[] = [
  "Navigation",
  "Repository",
  "Sync",
  "Branches",
  "Stash",
  "Tags",
  "Worktrees",
  "Settings",
];

// --- Store ---

export interface CommandRegistryState {
  commands: Map<string, Command>;
  register: (cmd: Command) => void;
  unregister: (id: string) => boolean;
  unregisterBySource: (source: string) => void;
  getAll: () => Command[];
  getEnabled: () => Command[];
  getById: (id: string) => Command | undefined;
  getOrderedCategories: () => CommandCategory[];
}

export const useCommandRegistry = create<CommandRegistryState>()(
  devtools(
    (set, get) => ({
      commands: new Map<string, Command>(),

      register: (cmd) => {
        const next = new Map(get().commands);
        next.set(cmd.id, { ...cmd, source: cmd.source ?? "core" });
        set({ commands: next }, false, "command-registry/register");
      },

      unregister: (id) => {
        const prev = get().commands;
        if (!prev.has(id)) return false;
        const next = new Map(prev);
        next.delete(id);
        set({ commands: next }, false, "command-registry/unregister");
        return true;
      },

      unregisterBySource: (source) => {
        const next = new Map(get().commands);
        for (const [id, cmd] of next) {
          if (cmd.source === source) {
            next.delete(id);
          }
        }
        set(
          { commands: next },
          false,
          "command-registry/unregisterBySource",
        );
      },

      getAll: () => {
        return Array.from(get().commands.values());
      },

      getEnabled: () => {
        return Array.from(get().commands.values()).filter((cmd) =>
          cmd.enabled ? cmd.enabled() : true,
        );
      },

      getById: (id) => {
        return get().commands.get(id);
      },

      getOrderedCategories: () => {
        const cmds = get().commands;
        const allCategories = new Set<CommandCategory>();
        for (const cmd of cmds.values()) {
          allCategories.add(cmd.category);
        }

        const coreSet = new Set<string>(CORE_ORDER);
        const ordered: CommandCategory[] = [];

        // Core categories in canonical order (only those that have commands)
        for (const cat of CORE_ORDER) {
          if (allCategories.has(cat)) {
            ordered.push(cat);
          }
        }

        // Extension categories alphabetically
        const extensionCats = Array.from(allCategories)
          .filter((cat) => !coreSet.has(cat))
          .sort();
        ordered.push(...extensionCats);

        return ordered;
      },
    }),
    { name: "command-registry", enabled: import.meta.env.DEV },
  ),
);

// --- Backward-compatible function exports ---

export function registerCommand(cmd: Command): void {
  useCommandRegistry.getState().register(cmd);
}

/** Remove a single command by ID. Returns true if it existed. */
export function unregisterCommand(id: string): boolean {
  return useCommandRegistry.getState().unregister(id);
}

/** Remove all commands matching the given source (e.g. "ext:github"). */
export function unregisterCommandsBySource(source: string): void {
  useCommandRegistry.getState().unregisterBySource(source);
}

export function getCommands(): Command[] {
  return useCommandRegistry.getState().getAll();
}

export function getEnabledCommands(): Command[] {
  return useCommandRegistry.getState().getEnabled();
}

export function getCommandById(id: string): Command | undefined {
  return useCommandRegistry.getState().getById(id);
}

export function executeCommand(id: string): void {
  const cmd = getCommandById(id);
  if (!cmd) return;
  if (cmd.enabled && !cmd.enabled()) return;
  cmd.action();
}

/**
 * Returns ordered categories: core categories first (in canonical order, filtered
 * to only those with registered commands), then extension categories alphabetically.
 */
export function getOrderedCategories(): CommandCategory[] {
  return useCommandRegistry.getState().getOrderedCategories();
}
