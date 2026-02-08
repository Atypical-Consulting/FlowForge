import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useSelector } from "@xstate/react";
import { useNavigationActorRef } from "../../machines/navigation/context";
import {
  selectBladeStack,
  selectLastAction,
  selectDirtyBladeIds,
} from "../../machines/navigation/selectors";
import {
  bladeTransitionVariants,
  bladeTransitionConfig,
} from "../../lib/animations";
import { BladeRenderer } from "./BladeRenderer";
import { BladeStrip } from "./BladeStrip";
import { NavigationGuardDialog } from "./NavigationGuardDialog";

export function BladeContainer() {
  const actorRef = useNavigationActorRef();
  const bladeStack = useSelector(actorRef, selectBladeStack);
  const lastAction = useSelector(actorRef, selectLastAction);
  const dirtyBladeIds = useSelector(actorRef, selectDirtyBladeIds);
  const shouldReduceMotion = useReducedMotion();
  const activeBlade = bladeStack[bladeStack.length - 1];

  return (
    <div className="flex h-full overflow-hidden">
      {/* Screen reader announcement for blade transitions */}
      <div aria-live="polite" className="sr-only">
        {lastAction === "push" && `Opened ${activeBlade.title}`}
        {lastAction === "pop" && `Returned to ${activeBlade.title}`}
        {lastAction === "replace" && `Switched to ${activeBlade.title}`}
        {lastAction === "reset" && `Navigated to ${activeBlade.title}`}
      </div>

      {bladeStack.slice(0, -1).map((blade, index) => (
        <BladeStrip
          key={blade.id}
          title={blade.title}
          isDirty={!!dirtyBladeIds[blade.id]}
          onExpand={() => actorRef.send({ type: "POP_TO_INDEX", index })}
        />
      ))}
      <AnimatePresence mode="popLayout" custom={lastAction}>
        <motion.div
          key={activeBlade.id}
          custom={lastAction}
          variants={bladeTransitionVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : bladeTransitionConfig[lastAction] || bladeTransitionConfig.push
          }
          className="flex-1 min-w-0"
        >
          <BladeRenderer
            blade={activeBlade}
            goBack={() => actorRef.send({ type: "POP_BLADE" })}
          />
        </motion.div>
      </AnimatePresence>
      <NavigationGuardDialog />
    </div>
  );
}
