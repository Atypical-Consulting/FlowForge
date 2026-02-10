import { useEffect, useCallback } from "react";
import { useSelector } from "@xstate/react";
import { useNavigationActorRef } from "../../../../../machines/navigation/context";

/**
 * Hook for blades to register dirty (unsaved) state with the navigation FSM.
 *
 * When a blade has unsaved changes, calling `markDirty()` will prevent
 * navigation away from that blade — the FSM enters `confirmingDiscard` state
 * and shows a confirmation dialog.
 *
 * Dirty state is automatically cleaned up on unmount to prevent leaked state.
 */
export function useBladeFormGuard(bladeId: string) {
  const actorRef = useNavigationActorRef();
  const isDirty = useSelector(
    actorRef,
    (snap) => !!snap.context.dirtyBladeIds[bladeId],
  );

  const markDirty = useCallback(() => {
    actorRef.send({ type: "MARK_DIRTY", bladeId });
  }, [actorRef, bladeId]);

  const markClean = useCallback(() => {
    actorRef.send({ type: "MARK_CLEAN", bladeId });
  }, [actorRef, bladeId]);

  // Auto-cleanup on unmount to prevent dirty state leaking
  useEffect(() => {
    return () => {
      actorRef.send({ type: "MARK_CLEAN", bladeId });
    };
  }, [actorRef, bladeId]);

  return { markDirty, markClean, isDirty };
}
