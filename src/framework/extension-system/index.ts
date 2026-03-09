export {
  type ActiveMenu,
  type ContextMenuContext,
  type ContextMenuItem,
  type ContextMenuLocation,
  type ContextMenuRegistryState,
  useContextMenuRegistry,
} from "./contextMenuRegistry";
export {
  type BladeNavigationEvent,
  type Disposable,
  ExtensionAPI,
  type ExtensionBladeConfig,
  type ExtensionCommandConfig,
  type ExtensionContextMenuConfig,
  type ExtensionGitHookConfig,
  type ExtensionMachineConfig,
  type ExtensionSidebarPanelConfig,
  type ExtensionStatusBarConfig,
  type ExtensionToolbarConfig,
} from "./ExtensionAPI";
export {
  CURRENT_API_VERSION,
  configureExtensionHost,
  useExtensionHost,
} from "./ExtensionHost";
export {
  type EventHandler,
  ExtensionEventBus,
  extensionEventBus,
} from "./eventBus";
// Registry stores (moved from core/lib/)
export {
  getMachineActor,
  type MachineRegistryEntry,
  type MachineRegistryState,
  registerMachine,
  unregisterMachine,
  unregisterMachinesBySource,
  useMachineRegistry,
} from "./machineRegistry";

// Extension manifest types
export type {
  ExtensionBladeContribution,
  ExtensionCommandContribution,
  ExtensionContributes,
  ExtensionManifest,
  ExtensionToolbarContribution,
} from "./manifest";
export {
  type DidHandler,
  OperationBus,
  type WillHandler,
  type WillHookResult,
} from "./operationBus";
export { ExtensionSettings } from "./settings";
export {
  getLeftItems,
  getRightItems,
  type StatusBarAlignment,
  type StatusBarItem,
  useStatusBarRegistry,
} from "./statusBarRegistry";
export {
  getGroupedToolbarActions,
  TOOLBAR_GROUP_ORDER,
  type ToolbarAction,
  type ToolbarGroup,
  useToolbarRegistry,
} from "./toolbarRegistry";
export type {
  BuiltInExtensionConfig,
  ExtensionInfo,
  ExtensionStatus,
  TrustLevel,
} from "./types";
