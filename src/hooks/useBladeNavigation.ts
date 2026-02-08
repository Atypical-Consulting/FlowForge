import type { FileChange } from "../bindings";
import type { BladeType, BladePropsMap } from "../stores/bladeTypes";
import { getBladeRegistration } from "../lib/bladeRegistry";
import { bladeTypeForFile } from "../lib/fileTypeUtils";
import { useBladeStore } from "../stores/blades";

const SINGLETON_TYPES: BladeType[] = [
  "settings",
  "changelog",
  "gitflow-cheatsheet",
];

export function useBladeNavigation() {
  const store = useBladeStore();

  /** Type-safe blade opener — compiler enforces correct props per type */
  function openBlade<K extends BladeType>(
    type: K,
    props: BladePropsMap[K],
    title?: string,
  ) {
    // Singleton guard: don't push duplicates
    if (SINGLETON_TYPES.includes(type)) {
      if (store.bladeStack.some((b) => b.type === type)) return;
    }

    const reg = getBladeRegistration(type);
    const resolvedTitle =
      title ??
      (typeof reg?.defaultTitle === "function"
        ? reg.defaultTitle(props as any)
        : reg?.defaultTitle ?? type);

    store.pushBlade({ type, title: resolvedTitle, props });
  }

  /** Push a diff/viewer blade for a historical commit file */
  function openDiff(oid: string, filePath: string) {
    const type = bladeTypeForFile(filePath);
    const title = filePath.split("/").pop() || filePath;

    if (type === "diff" || type === "viewer-markdown") {
      openBlade("diff", { source: { mode: "commit", oid, filePath } }, title);
    } else if (type === "viewer-image") {
      openBlade("viewer-image", { filePath, oid }, title);
    } else {
      store.pushBlade({ type, title, props: { filePath } as any });
    }
  }

  /** Push a diff/viewer blade for a staging (working-tree) file */
  function openStagingDiff(
    file: FileChange,
    section: "staged" | "unstaged" | "untracked",
  ) {
    const type = bladeTypeForFile(file.path);
    const title = file.path.split("/").pop() || file.path;

    if (type === "diff" || type === "viewer-markdown") {
      openBlade(
        "diff",
        { source: { mode: "staging", filePath: file.path, staged: section === "staged" } },
        title,
      );
    } else if (type === "viewer-image") {
      openBlade("viewer-image", { filePath: file.path }, title);
    } else {
      store.pushBlade({ type, title, props: { filePath: file.path } as any });
    }
  }

  const goBack = store.popBlade;
  const goToRoot = store.resetStack;

  return {
    openBlade,
    openDiff,
    openStagingDiff,
    goBack,
    goToRoot,
    ...store,
  };
}
