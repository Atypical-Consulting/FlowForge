// Domain stores
export { useGitOpsStore } from "./domain/git-ops";
export type { GitOpsStore } from "./domain/git-ops";
export { useUIStore } from "./domain/ui-state";
export type { UIStore } from "./domain/ui-state";
export { usePreferencesStore, initAllPreferences } from "./domain/preferences";
export type { PreferencesStore } from "./domain/preferences";

// Infrastructure (standalone)
export { useToastStore, toast } from "./toast";
export type { Toast, ToastType } from "./toast";

// Store utilities
export { resetAllStores, registerStoreForReset } from "./registry";
export { createBladeStore } from "./createBladeStore";

// Type definitions
export type { BladeType, BladePropsMap, TypedBlade } from "./bladeTypes";
