import type { SnapshotFrom } from "xstate";
import type { navigationMachine } from "./navigationMachine";

type NavSnapshot = SnapshotFrom<typeof navigationMachine>;

export const selectBladeStack = (snap: NavSnapshot) =>
  snap.context.bladeStack;

export const selectActiveBlade = (snap: NavSnapshot) =>
  snap.context.bladeStack[snap.context.bladeStack.length - 1];

export const selectActiveWorkflow = (snap: NavSnapshot) =>
  snap.context.activeWorkflow;

export const selectIsConfirmingDiscard = (snap: NavSnapshot) =>
  snap.matches("confirmingDiscard");

export const selectLastAction = (snap: NavSnapshot) =>
  snap.context.lastAction;

export const selectDirtyBladeIds = (snap: NavSnapshot) =>
  snap.context.dirtyBladeIds;

export const selectPendingEvent = (snap: NavSnapshot) =>
  snap.context.pendingEvent;

export const selectStackDepth = (snap: NavSnapshot) =>
  snap.context.bladeStack.length;
