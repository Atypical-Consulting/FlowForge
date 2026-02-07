import type { FileChange } from "../bindings";
import type { BladeType } from "../stores/blades";
import { useBladeStore } from "../stores/blades";

/** Map file extension to a specialized blade type, or "diff" as default */
function bladeTypeForFile(filePath: string): BladeType {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".nupkg")) return "viewer-nupkg";
  if (
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".gif") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".svg") ||
    lower.endsWith(".ico")
  )
    return "viewer-image";
  if (lower.endsWith(".md") || lower.endsWith(".mdx"))
    return "viewer-markdown";
  if (lower.endsWith(".glb") || lower.endsWith(".gltf"))
    return "viewer-3d";
  return "diff";
}

export function useBladeNavigation() {
  const store = useBladeStore();

  const openCommitDetails = (oid: string) => {
    store.pushBlade({
      type: "commit-details",
      title: "Commit",
      props: { oid },
    });
  };

  /** Push a diff blade for a historical commit file */
  const openDiff = (oid: string, filePath: string) => {
    const type = bladeTypeForFile(filePath);
    store.pushBlade({
      type,
      title: filePath.split("/").pop() || filePath,
      props: { mode: "commit", oid, filePath },
    });
  };

  /** Push a diff/viewer blade for a staging (working-tree) file */
  const openStagingDiff = (
    file: FileChange,
    section: "staged" | "unstaged" | "untracked",
  ) => {
    const type = bladeTypeForFile(file.path);
    store.pushBlade({
      type,
      title: file.path.split("/").pop() || file.path,
      props: {
        mode: "staging",
        filePath: file.path,
        staged: section === "staged",
      },
    });
  };

  const openSettings = () => {
    store.pushBlade({ type: "settings", title: "Settings", props: {} });
  };

  const openChangelog = () => {
    store.pushBlade({ type: "changelog", title: "Changelog", props: {} });
  };

  const openRepoBrowser = (path?: string) => {
    store.pushBlade({
      type: "repo-browser",
      title: "Repository Browser",
      props: { path: path || "" },
    });
  };

  const openGitflowCheatsheet = () => {
    store.pushBlade({
      type: "gitflow-cheatsheet",
      title: "Gitflow Guide",
      props: {},
    });
  };

  const openMarkdownViewer = (filePath: string) => {
    store.pushBlade({
      type: "viewer-markdown",
      title: filePath.split("/").pop() || "Markdown",
      props: { filePath },
    });
  };

  const openModelViewer = (filePath: string) => {
    store.pushBlade({
      type: "viewer-3d",
      title: filePath.split("/").pop() || "3D Model",
      props: { filePath },
    });
  };

  const goBack = () => store.popBlade();
  const goToRoot = () => store.resetStack();

  return {
    ...store,
    openCommitDetails,
    openDiff,
    openStagingDiff,
    openSettings,
    openChangelog,
    openRepoBrowser,
    openGitflowCheatsheet,
    openMarkdownViewer,
    openModelViewer,
    goBack,
    goToRoot,
  };
}
