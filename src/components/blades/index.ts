// Re-exports from new locations (migration period)
export { BladeContainer } from "../../blades/_shared/BladeContainer";
export { BladePanel } from "../../blades/_shared/BladePanel";
export { BladeStrip } from "../../blades/_shared/BladeStrip";
export { BladeRenderer } from "../../blades/_shared/BladeRenderer";
export { BladeErrorBoundary } from "../../blades/_shared/BladeErrorBoundary";
export { BladeLoadingFallback } from "../../blades/_shared/BladeLoadingFallback";
export { ProcessNavigation } from "../../blades/_shared/ProcessNavigation";
export { FileTreeBlade } from "../../blades/_shared/FileTreeBlade";

// Blade components — migrated to new locations
export { ChangelogBlade } from "../../blades/changelog/ChangelogBlade";
export { DiffBlade } from "./DiffBlade";
export { StagingChangesBlade } from "./StagingChangesBlade";
export { TopologyRootBlade } from "./TopologyRootBlade";
export { ViewerNupkgBlade } from "../../blades/viewer-nupkg/ViewerNupkgBlade";
