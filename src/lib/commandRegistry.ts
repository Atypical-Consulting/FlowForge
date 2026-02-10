import type { LucideIcon } from "lucide-react";

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

const commands = new Map<string, Command>();

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

export function registerCommand(cmd: Command): void {
  commands.set(cmd.id, cmd);
}

/** Remove a single command by ID. Returns true if it existed. */
export function unregisterCommand(id: string): boolean {
  return commands.delete(id);
}

/** Remove all commands matching the given source (e.g. "ext:github"). */
export function unregisterCommandsBySource(source: string): void {
  for (const [id, cmd] of commands) {
    if (cmd.source === source) {
      commands.delete(id);
    }
  }
}

export function getCommands(): Command[] {
  return Array.from(commands.values());
}

export function getEnabledCommands(): Command[] {
  return Array.from(commands.values()).filter((cmd) => (cmd.enabled ? cmd.enabled() : true));
}

export function getCommandById(id: string): Command | undefined {
  return commands.get(id);
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
  const allCategories = new Set<CommandCategory>();
  for (const cmd of commands.values()) {
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
}
