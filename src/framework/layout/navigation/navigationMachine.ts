import { and, assign, not, setup } from "xstate";
import { toast } from "../../stores/toast";
import { isSingletonBlade } from "../bladeRegistry";
import {
  isEmptyRootBlade,
  resolveWorkflowId,
  rootBladeForWorkflow,
} from "./actions";
import type { NavigationContext, NavigationEvent, TypedBlade } from "./types";
import { getDefaultWorkflowId, getWorkflow } from "./workflowRegistry";

const DEFAULT_MAX_STACK_DEPTH = 8;

export const navigationMachine = setup({
  types: {
    context: {} as NavigationContext,
    events: {} as NavigationEvent,
  },
  guards: {
    isNotSingleton: ({ context, event }) => {
      if (event.type !== "PUSH_BLADE") return true;
      if (!isSingletonBlade(event.bladeType)) return true;
      return !context.bladeStack.some((b) => b.type === event.bladeType);
    },
    isUnderMaxDepth: ({ context }) =>
      context.bladeStack.length < context.maxStackDepth,
    hasMultipleBlades: ({ context }) => context.bladeStack.length > 1,
    hasDirtyBlades: ({ context }) =>
      Object.keys(context.dirtyBladeIds).length > 0,
    isTopBladeDirty: ({ context }) => {
      const topBlade = context.bladeStack[context.bladeStack.length - 1];
      return topBlade ? !!context.dirtyBladeIds[topBlade.id] : false;
    },
    isValidIndex: ({ event }) => {
      if (event.type !== "POP_TO_INDEX") return false;
      return event.index >= 0;
    },
    hasDirtyBladesAboveIndex: ({ context, event }) => {
      if (event.type !== "POP_TO_INDEX") return false;
      const bladesAbove = context.bladeStack.slice(event.index + 1);
      return bladesAbove.some((b) => !!context.dirtyBladeIds[b.id]);
    },
    /**
     * The active workflow is not registered (actor created before the
     * workflows, or the workflow was removed) or the root is the "empty"
     * placeholder — the stack needs to be re-rooted on a registered workflow.
     */
    needsWorkflowHeal: ({ context }) =>
      !getWorkflow(context.activeWorkflow) ||
      isEmptyRootBlade(context.bladeStack[0]),
  },
  actions: {
    pushBlade: assign(({ context, event }) => {
      if (event.type !== "PUSH_BLADE") return {};
      return {
        bladeStack: [
          ...context.bladeStack,
          {
            id: crypto.randomUUID(),
            type: event.bladeType,
            title: event.title,
            props: event.props,
          } as TypedBlade,
        ],
        lastAction: "push" as const,
      };
    }),
    popBlade: assign(({ context }) => {
      const topBlade = context.bladeStack[context.bladeStack.length - 1];
      const dirtyBladeIds =
        topBlade && context.dirtyBladeIds[topBlade.id]
          ? (() => {
              const { [topBlade.id]: _, ...rest } = context.dirtyBladeIds;
              return rest;
            })()
          : context.dirtyBladeIds;
      return {
        bladeStack: context.bladeStack.slice(0, -1),
        dirtyBladeIds,
        lastAction: "pop" as const,
      };
    }),
    popToIndex: assign(({ context, event }) => {
      if (event.type !== "POP_TO_INDEX") return {};
      const keptIds = new Set(
        context.bladeStack.slice(0, event.index + 1).map((b) => b.id),
      );
      const dirtyBladeIds: Record<string, true> = {};
      for (const id of Object.keys(context.dirtyBladeIds)) {
        if (keptIds.has(id)) dirtyBladeIds[id] = true;
      }
      return {
        bladeStack: context.bladeStack.slice(0, event.index + 1),
        dirtyBladeIds,
        lastAction: "pop" as const,
      };
    }),
    replaceBlade: assign(({ context, event }) => {
      if (event.type !== "REPLACE_BLADE") return {};
      return {
        bladeStack: [
          ...context.bladeStack.slice(0, -1),
          {
            id: crypto.randomUUID(),
            type: event.bladeType,
            title: event.title,
            props: event.props,
          } as TypedBlade,
        ],
        lastAction: "replace" as const,
      };
    }),
    resetStack: assign(({ context }) => {
      const workflow = resolveWorkflowId(context.activeWorkflow);
      return {
        activeWorkflow: workflow,
        bladeStack: [rootBladeForWorkflow(workflow)],
        dirtyBladeIds: {} as Record<string, true>,
        lastAction: "reset" as const,
      };
    }),
    switchWorkflow: assign(({ event }) => {
      if (event.type !== "SWITCH_WORKFLOW") return {};
      // Unknown ids (e.g. a persisted workflow whose extension is gone) fall
      // back to the default workflow instead of producing an unusable root.
      const workflow = resolveWorkflowId(event.workflow);
      return {
        activeWorkflow: workflow,
        bladeStack: [rootBladeForWorkflow(workflow)],
        dirtyBladeIds: {} as Record<string, true>,
        lastAction: "reset" as const,
      };
    }),
    healWorkflow: assign(({ context }) => {
      const workflow = resolveWorkflowId(context.activeWorkflow);
      // Replace only the root; anything pushed on top of it is preserved.
      return {
        activeWorkflow: workflow,
        bladeStack: [
          rootBladeForWorkflow(workflow),
          ...context.bladeStack.slice(1),
        ],
        lastAction: "reset" as const,
      };
    }),
    markDirty: assign(({ context, event }) => {
      if (event.type !== "MARK_DIRTY") return {};
      return {
        dirtyBladeIds: {
          ...context.dirtyBladeIds,
          [event.bladeId]: true as const,
        },
      };
    }),
    markClean: assign(({ context, event }) => {
      if (event.type !== "MARK_CLEAN") return {};
      const { [event.bladeId]: _, ...rest } = context.dirtyBladeIds;
      return { dirtyBladeIds: rest };
    }),
    storePendingEvent: assign(({ event }) => ({
      pendingEvent: event,
    })),
    clearPendingEvent: assign({
      pendingEvent: () => null as NavigationEvent | null,
    }),
    replayPendingEvent: assign(({ context }) => {
      const pending = context.pendingEvent;
      if (!pending) {
        return { pendingEvent: null, dirtyBladeIds: {} };
      }

      const base = {
        pendingEvent: null as NavigationEvent | null,
        dirtyBladeIds: {} as Record<string, true>,
      };

      switch (pending.type) {
        case "POP_BLADE":
          return {
            ...base,
            bladeStack: context.bladeStack.slice(0, -1),
            lastAction: "pop" as const,
          };
        case "POP_TO_INDEX":
          return {
            ...base,
            bladeStack: context.bladeStack.slice(0, pending.index + 1),
            lastAction: "pop" as const,
          };
        case "REPLACE_BLADE":
          return {
            ...base,
            bladeStack: [
              ...context.bladeStack.slice(0, -1),
              {
                id: crypto.randomUUID(),
                type: pending.bladeType,
                title: pending.title,
                props: pending.props,
              } as TypedBlade,
            ],
            lastAction: "replace" as const,
          };
        case "RESET_STACK": {
          const workflow = resolveWorkflowId(context.activeWorkflow);
          return {
            ...base,
            activeWorkflow: workflow,
            bladeStack: [rootBladeForWorkflow(workflow)],
            lastAction: "reset" as const,
          };
        }
        case "SWITCH_WORKFLOW": {
          const workflow = resolveWorkflowId(pending.workflow);
          return {
            ...base,
            activeWorkflow: workflow,
            bladeStack: [rootBladeForWorkflow(workflow)],
            lastAction: "reset" as const,
          };
        }
        default:
          return base;
      }
    }),
    notifyMaxDepth: () => {
      // Side effect: toast notification. Overridable via machine.provide() in tests.
      toast.info("Maximum blade depth reached. Close some blades first.");
    },
    notifySingletonExists: ({ event }) => {
      if (event.type === "PUSH_BLADE") {
        toast.info(`${event.title ?? event.bladeType} is already open`);
      }
    },
  },
}).createMachine({
  id: "bladeNavigation",
  initial: "navigating",
  context: () => ({
    activeWorkflow: getDefaultWorkflowId(),
    bladeStack: [rootBladeForWorkflow(getDefaultWorkflowId())],
    dirtyBladeIds: {} as Record<string, true>,
    lastAction: "init" as const,
    maxStackDepth: DEFAULT_MAX_STACK_DEPTH,
    pendingEvent: null as NavigationEvent | null,
  }),
  // Root-level so it applies in every state: the registry can change at any
  // time (extension activation, production chunk evaluation order).
  on: {
    WORKFLOWS_CHANGED: {
      guard: "needsWorkflowHeal",
      actions: "healWorkflow",
    },
  },
  states: {
    navigating: {
      on: {
        PUSH_BLADE: [
          {
            guard: not("isUnderMaxDepth"),
            actions: "notifyMaxDepth",
          },
          {
            guard: and(["isNotSingleton", "isUnderMaxDepth"]),
            actions: "pushBlade",
          },
          {
            // Fallback: singleton already in stack
            actions: "notifySingletonExists",
          },
        ],
        POP_BLADE: [
          {
            guard: and(["hasMultipleBlades", "isTopBladeDirty"]),
            target: "confirmingDiscard",
            actions: "storePendingEvent",
          },
          {
            guard: "hasMultipleBlades",
            actions: "popBlade",
          },
        ],
        POP_TO_INDEX: [
          {
            guard: and(["isValidIndex", "hasDirtyBladesAboveIndex"]),
            target: "confirmingDiscard",
            actions: "storePendingEvent",
          },
          {
            guard: "isValidIndex",
            actions: "popToIndex",
          },
        ],
        REPLACE_BLADE: [
          {
            guard: "isTopBladeDirty",
            target: "confirmingDiscard",
            actions: "storePendingEvent",
          },
          {
            actions: "replaceBlade",
          },
        ],
        RESET_STACK: [
          {
            guard: "hasDirtyBlades",
            target: "confirmingDiscard",
            actions: "storePendingEvent",
          },
          {
            actions: "resetStack",
          },
        ],
        SWITCH_WORKFLOW: [
          {
            guard: "hasDirtyBlades",
            target: "confirmingDiscard",
            actions: "storePendingEvent",
          },
          {
            actions: "switchWorkflow",
          },
        ],
        MARK_DIRTY: {
          actions: "markDirty",
        },
        MARK_CLEAN: {
          actions: "markClean",
        },
      },
    },
    confirmingDiscard: {
      on: {
        CONFIRM_DISCARD: {
          target: "navigating",
          actions: "replayPendingEvent",
        },
        CANCEL_DISCARD: {
          target: "navigating",
          actions: "clearPendingEvent",
        },
      },
    },
  },
});
