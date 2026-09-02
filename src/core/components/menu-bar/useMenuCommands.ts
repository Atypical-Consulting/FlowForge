import {
  type Command,
  useCommandRegistry,
} from "@/framework/command-palette/commandRegistry";
import { useGitOpsStore as useRepositoryStore } from "../../stores/domain/git-ops";

export interface MenuCommandState {
  command: Command | undefined;
  /** True when the command is unregistered or its `enabled()` predicate is false. */
  disabled: boolean;
}

/**
 * Resolves menu entries to live command state.
 *
 * Command `enabled()` predicates read the repository store imperatively, so
 * this hook subscribes to both the command registry (commands appear when
 * extensions activate) and `repoStatus` (open/close) to make sure enablement
 * is re-evaluated on every relevant change — same pattern as the Toolbar's
 * `when()` handling.
 */
export function useMenuCommands(): (commandId: string) => MenuCommandState {
  const commands = useCommandRegistry((s) => s.items);
  // Subscribed for re-render only: enabled() predicates read this imperatively.
  useRepositoryStore((s) => s.repoStatus);

  // Deliberately not memoized: callers evaluate it during render, and a fresh
  // closure guarantees enabled() is re-run after every store change.
  return (commandId: string): MenuCommandState => {
    const command = commands.get(commandId);
    if (!command) return { command: undefined, disabled: true };
    return { command, disabled: command.enabled ? !command.enabled() : false };
  };
}
