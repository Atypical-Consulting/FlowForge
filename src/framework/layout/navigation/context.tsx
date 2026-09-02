import { createContext, type ReactNode, useContext } from "react";
import { type ActorRefFrom, createActor } from "xstate";
import { navigationMachine } from "./navigationMachine";
import { subscribeWorkflows } from "./workflowRegistry";

type NavigationActorRef = ActorRefFrom<typeof navigationMachine>;

// Module-level singleton actor — lives outside React lifecycle so it survives
// StrictMode double-mount and component re-renders without being stopped.
//
// It is created *lazily* on first access rather than at module evaluation:
// in the production bundle this module lands in a shared chunk that the entry
// chunk imports before its own body registers the workflows, so starting the
// actor at import time would snapshot an empty registry ("Empty" root blade).
let _navigationActor: NavigationActorRef | null = null;

function createNavigationActor(): NavigationActorRef {
  const actor = createActor(navigationMachine);
  // Self-heal: whenever the registry changes (a workflow registered after the
  // actor started, or the active workflow removed), let the machine re-resolve
  // its active workflow and root blade. The subscription lives as long as the
  // singleton.
  subscribeWorkflows(() => {
    actor.send({ type: "WORKFLOWS_CHANGED" });
  });
  actor.start();
  return actor;
}

/** Get the module-level navigation actor for non-React access (bladeOpener, keyboard shortcuts). */
export function getNavigationActor(): NavigationActorRef {
  if (!_navigationActor) {
    _navigationActor = createNavigationActor();
  }
  return _navigationActor;
}

/** @deprecated No longer needed — actor is a module-level singleton. Kept for test compatibility. */
export function setNavigationActor(_ref: NavigationActorRef | null): void {
  // no-op: actor is a module-level singleton
}

const NavigationActorContext = createContext<NavigationActorRef | null>(null);

/**
 * React hook to get the navigation actor ref.
 * Falls back to the module-level singleton when rendered outside NavigationProvider.
 */
export function useNavigationActorRef(): NavigationActorRef {
  return useContext(NavigationActorContext) ?? getNavigationActor();
}

/** Provider that exposes the module-level navigation actor via React context. */
export function NavigationProvider({ children }: { children: ReactNode }) {
  return (
    <NavigationActorContext.Provider value={getNavigationActor()}>
      {children}
    </NavigationActorContext.Provider>
  );
}
