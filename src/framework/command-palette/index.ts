export {
  type CoreCommandCategory,
  type CommandCategory,
  type Command,
  type CommandRegistryState,
  useCommandRegistry,
  registerCommand,
  unregisterCommand,
  unregisterCommandsBySource,
  getCommands,
  getEnabledCommands,
  getCommandById,
  executeCommand,
  getOrderedCategories,
} from "./commandRegistry";

export {
  type ScoredCommand,
  searchCommands,
  fuzzyMatch,
  highlightMatches,
} from "./fuzzySearch";

export { CommandPalette } from "./components";

export { formatShortcut } from "./formatShortcut";

export { usePaletteStore, type PaletteState } from "./paletteStore";
