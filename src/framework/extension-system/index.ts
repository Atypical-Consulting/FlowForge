export { CURRENT_API_VERSION, useExtensionHost, configureExtensionHost } from "./ExtensionHost";
export {
  type BladeNavigationEvent,
  type ExtensionBladeConfig,
  type ExtensionCommandConfig,
  type ExtensionToolbarConfig,
  type ExtensionContextMenuConfig,
  type ExtensionSidebarPanelConfig,
  type ExtensionStatusBarConfig,
  type ExtensionGitHookConfig,
  type ExtensionMachineConfig,
  type Disposable,
  ExtensionAPI,
} from "./ExtensionAPI";
export {
  type TrustLevel,
  type ExtensionStatus,
  type ExtensionInfo,
  type BuiltInExtensionConfig,
} from "./types";
export {
  type EventHandler,
  ExtensionEventBus,
  extensionEventBus,
} from "./eventBus";
export { ExtensionSettings } from "./settings";

// Extension manifest types
export type {
  ExtensionManifest,
  ExtensionContributes,
  ExtensionBladeContribution,
  ExtensionCommandContribution,
  ExtensionToolbarContribution,
} from "./manifest";

// Registry stores (moved from core/lib/)
export {
  useMachineRegistry,
  registerMachine,
  unregisterMachine,
  unregisterMachinesBySource,
  getMachineActor,
  type MachineRegistryEntry,
  type MachineRegistryState,
} from "./machineRegistry";
export {
  useToolbarRegistry,
  type ToolbarAction,
  type ToolbarGroup,
  TOOLBAR_GROUP_ORDER,
  getGroupedToolbarActions,
} from "./toolbarRegistry";
export {
  useContextMenuRegistry,
  type ContextMenuItem,
  type ContextMenuContext,
  type ContextMenuLocation,
  type ActiveMenu,
  type ContextMenuRegistryState,
} from "./contextMenuRegistry";
export {
  useStatusBarRegistry,
  type StatusBarItem,
  type StatusBarAlignment,
  getLeftItems,
  getRightItems,
} from "./statusBarRegistry";
export {
  OperationBus,
  type GitHookBus,
  gitHookBus,
  type GitOperation,
  type GitHookContext,
  type WillHookResult,
  type DidHandler,
  type WillHandler,
} from "./operationBus";
