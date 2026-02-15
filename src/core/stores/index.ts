// Domain stores
export { useGitOpsStore } from "./domain/git-ops";
export type { GitOpsStore } from "./domain/git-ops";
export { useUIStore } from "./domain/ui-state";
export type { UIStore } from "./domain/ui-state";
export { usePreferencesStore, initAllPreferences } from "./domain/preferences";
export type { PreferencesStore } from "./domain/preferences";

// Infrastructure (re-exported from framework)
export { useToastStore, toast } from "@/framework/stores/toast";
export type { Toast, ToastType } from "@/framework/stores/toast";

// Store utilities (re-exported from framework)
export { resetAllStores, registerStoreForReset } from "@/framework/stores/registry";
export { createBladeStore } from "@/framework/stores/createBladeStore";

// Type definitions
export type { BladeType, BladePropsMap, TypedBlade } from "./bladeTypes";
