import type { LucideIcon } from "lucide-react";

export type CommandCategory =
  | "Repository"
  | "Branches"
  | "Sync"
  | "Stash"
  | "Tags"
  | "Worktrees"
  | "Navigation"
  | "Settings";

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
}

const commands: Command[] = [];

export function registerCommand(cmd: Command): void {
  const existingIndex = commands.findIndex((c) => c.id === cmd.id);
  if (existingIndex >= 0) {
    commands[existingIndex] = cmd;
  } else {
    commands.push(cmd);
  }
}

export function getCommands(): Command[] {
  return commands;
}

export function getEnabledCommands(): Command[] {
  return commands.filter((cmd) => (cmd.enabled ? cmd.enabled() : true));
}

export function getCommandById(id: string): Command | undefined {
  return commands.find((cmd) => cmd.id === id);
}

export function executeCommand(id: string): void {
  const cmd = getCommandById(id);
  if (!cmd) return;
  if (cmd.enabled && !cmd.enabled()) return;
  cmd.action();
}
