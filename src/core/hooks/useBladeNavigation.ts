import { useSelector } from "@xstate/react";
import type { FileChange } from "../../bindings";
import { getBladeRegistration } from "@/framework/layout/bladeRegistry";
import { bladeTypeForFile } from "../lib/fileTypeUtils";
import {
  useNavigationActorRef,
} from "@/framework/layout/navigation/context";
import {
  selectActiveProcess,
  selectBladeStack,
  selectLastAction,
  selectDirtyBladeIds,
} from "@/framework/layout/navigation/selectors";
import type { BladeType, BladePropsMap, CoreBladeType, ProcessType, TypedBlade } from "@/framework/layout/navigation/types";

export function useBladeNavigation() {
  const actorRef = useNavigationActorRef();
  const bladeStack = useSelector(actorRef, selectBladeStack);
  const activeProcess = useSelector(actorRef, selectActiveProcess);
  const lastAction = useSelector(actorRef, selectLastAction);
  const dirtyBladeIds = useSelector(actorRef, selectDirtyBladeIds);

  /** Type-safe blade opener for core blades */
  function openBlade<K extends CoreBladeType>(
    type: K,
    props: BladePropsMap[K],
    title?: string,
  ): void;
  /** Blade opener for extension blade types */
  function openBlade(
    type: string,
    props: Record<string, unknown>,
    title?: string,
  ): void;
  function openBlade(
    type: string,
    props: Record<string, unknown>,
    title?: string,
  ) {
    const reg = getBladeRegistration(type);
    const resolvedTitle =
      title ??
      (typeof reg?.defaultTitle === "function"
        ? reg.defaultTitle(props as any)
        : reg?.defaultTitle ?? type);

    actorRef.send({ type: "PUSH_BLADE", bladeType: type as BladeType, title: resolvedTitle, props });
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
      actorRef.send({
        type: "PUSH_BLADE",
        bladeType: type,
        title,
        props: { filePath } as Record<string, unknown>,
      });
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
      actorRef.send({
        type: "PUSH_BLADE",
        bladeType: type,
        title,
        props: { filePath: file.path } as Record<string, unknown>,
      });
    }
  }

  /** Type-safe pushBlade for core blade types */
  function pushBlade<K extends CoreBladeType>(blade: {
    type: K;
    title: string;
    props: BladePropsMap[K];
  }): void;
  /** pushBlade for extension blade types */
  function pushBlade(blade: {
    type: string;
    title: string;
    props: Record<string, unknown>;
  }): void;
  function pushBlade(blade: {
    type: string;
    title: string;
    props: Record<string, unknown>;
  }) {
    actorRef.send({
      type: "PUSH_BLADE",
      bladeType: blade.type as BladeType,
      title: blade.title,
      props: blade.props,
    });
  }

  /** Type-safe replaceBlade for core blade types */
  function replaceBlade<K extends CoreBladeType>(blade: {
    type: K;
    title: string;
    props: BladePropsMap[K];
  }): void;
  /** replaceBlade for extension blade types */
  function replaceBlade(blade: {
    type: string;
    title: string;
    props: Record<string, unknown>;
  }): void;
  function replaceBlade(blade: {
    type: string;
    title: string;
    props: Record<string, unknown>;
  }) {
    actorRef.send({
      type: "REPLACE_BLADE",
      bladeType: blade.type as BladeType,
      title: blade.title,
      props: blade.props,
    });
  }

  return {
    openBlade,
    openDiff,
    openStagingDiff,
    goBack: () => actorRef.send({ type: "POP_BLADE" }),
    goToRoot: () => actorRef.send({ type: "RESET_STACK" }),
    pushBlade,
    popBlade: () => actorRef.send({ type: "POP_BLADE" }),
    popToIndex: (index: number) => actorRef.send({ type: "POP_TO_INDEX", index }),
    replaceBlade,
    resetStack: () => actorRef.send({ type: "RESET_STACK" }),
    setProcess: (process: ProcessType) => actorRef.send({ type: "SWITCH_PROCESS", process }),
    markDirty: (bladeId: string) => actorRef.send({ type: "MARK_DIRTY", bladeId }),
    markClean: (bladeId: string) => actorRef.send({ type: "MARK_CLEAN", bladeId }),
    bladeStack,
    activeProcess,
    lastAction,
    dirtyBladeIds,
  };
}
