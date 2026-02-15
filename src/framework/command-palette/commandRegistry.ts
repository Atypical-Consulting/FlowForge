import type { LucideIcon } from "lucide-react";
import { createRegistry } from "../stores/createRegistry";

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

const _useCommandRegistry = createRegistry<Command>({
  name: "command-registry",
});

// Wrap register to default source to "core"
const originalRegister = _useCommandRegistry.getState().register;
const wrappedRegister = (cmd: Command) => {
  originalRegister({ ...cmd, source: cmd.source ?? "core" });
};

// Patch the store's register function
_useCommandRegistry.setState({ register: wrappedRegister } as any);

export const useCommandRegistry = _useCommandRegistry;

// --- Standalone query functions ---

export function getEnabled(): Command[] {
  return Array.from(useCommandRegistry.getState().items.values()).filter((cmd) =>
    cmd.enabled ? cmd.enabled() : true,
  );
}

export function getOrderedCategories(): CommandCategory[] {
  const cmds = useCommandRegistry.getState().items;
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
}

export function getById(id: string): Command | undefined {
  return useCommandRegistry.getState().get(id);
}

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
  return getEnabled();
}

export function getCommandById(id: string): Command | undefined {
  return useCommandRegistry.getState().get(id);
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
export { getOrderedCategories as getOrderedCommandCategories };
