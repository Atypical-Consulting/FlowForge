// Re-exports from new locations (migration period)
export { BladeContainer } from "../../blades/_shared/BladeContainer";
export { BladePanel } from "../../blades/_shared/BladePanel";
export { BladeStrip } from "../../blades/_shared/BladeStrip";
export { BladeRenderer } from "../../blades/_shared/BladeRenderer";
export { BladeErrorBoundary } from "../../blades/_shared/BladeErrorBoundary";
export { BladeLoadingFallback } from "../../blades/_shared/BladeLoadingFallback";
export { ProcessNavigation } from "../../blades/_shared/ProcessNavigation";
export { FileTreeBlade } from "../../blades/_shared/FileTreeBlade";

// Blade components — still in old location during migration
export { ChangelogBlade } from "./ChangelogBlade";
export { CommitDetailsBlade } from "./CommitDetailsBlade";
export { DiffBlade } from "./DiffBlade";
export { SettingsBlade } from "./SettingsBlade";
export { StagingChangesBlade } from "./StagingChangesBlade";
export { TopologyRootBlade } from "./TopologyRootBlade";
export { ViewerImageBlade } from "./ViewerImageBlade";
export { ViewerNupkgBlade } from "./ViewerNupkgBlade";
