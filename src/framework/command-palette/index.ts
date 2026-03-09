export {
  type Command,
  type CommandCategory,
  type CoreCommandCategory,
  executeCommand,
  getById,
  getCommandById,
  getCommands,
  getEnabled,
  getEnabledCommands,
  getOrderedCategories,
  getOrderedCommandCategories,
  registerCommand,
  unregisterCommand,
  unregisterCommandsBySource,
  useCommandRegistry,
} from "./commandRegistry";
export { CommandPalette } from "./components";
export { formatShortcut } from "./formatShortcut";
export {
  fuzzyMatch,
  highlightMatches,
  type ScoredCommand,
  searchCommands,
} from "./fuzzySearch";

export { type PaletteState, usePaletteStore } from "./paletteStore";
