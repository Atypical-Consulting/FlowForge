import type { NavigationContext, NavigationEvent } from "./types";

type GuardArgs = {
  context: NavigationContext;
  event: NavigationEvent;
};

/** Singleton blade types that can only appear once in the stack. */
const SINGLETON_TYPES = new Set(["settings", "changelog", "gitflow-cheatsheet"]);

export const navigationGuards = {
  /** NAV-05: Prevent duplicate singleton blades in the stack */
  isNotSingleton: ({ context, event }: GuardArgs) => {
    if (event.type !== "PUSH_BLADE") return true;
    if (!SINGLETON_TYPES.has(event.bladeType)) return true;
    return !context.bladeStack.some((b) => b.type === event.bladeType);
  },

  /** NAV-06: Stack hasn't reached max depth */
  isUnderMaxDepth: ({ context }: GuardArgs) => {
    return context.bladeStack.length < context.maxStackDepth;
  },

  /** Root blade protection: never pop the last blade */
  hasMultipleBlades: ({ context }: GuardArgs) => {
    return context.bladeStack.length > 1;
  },

  /** NAV-03: Check if any blade has unsaved changes */
  hasDirtyBlades: ({ context }: GuardArgs) => {
    return Object.keys(context.dirtyBladeIds).length > 0;
  },

  /** NAV-03: Check if the top blade is dirty */
  isTopBladeDirty: ({ context }: GuardArgs) => {
    const topBlade = context.bladeStack[context.bladeStack.length - 1];
    return topBlade ? !!context.dirtyBladeIds[topBlade.id] : false;
  },

  /** Valid popToIndex range */
  isValidIndex: ({ context, event }: GuardArgs) => {
    if (event.type !== "POP_TO_INDEX") return false;
    return event.index >= 0 && event.index < context.bladeStack.length;
  },

  /** NAV-03: Check if any blade above the target index is dirty */
  hasDirtyBladesAboveIndex: ({ context, event }: GuardArgs) => {
    if (event.type !== "POP_TO_INDEX") return false;
    const bladesAbove = context.bladeStack.slice(event.index + 1);
    return bladesAbove.some((b) => !!context.dirtyBladeIds[b.id]);
  },
};
