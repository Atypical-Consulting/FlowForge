import { createContext, useContext, type ReactNode } from "react";
import { createActor, type ActorRefFrom } from "xstate";
import { navigationMachine } from "./navigationMachine";

type NavigationActorRef = ActorRefFrom<typeof navigationMachine>;

// Module-level singleton actor — lives outside React lifecycle so it survives
// StrictMode double-mount and component re-renders without being stopped.
const _navigationActor: NavigationActorRef = createActor(navigationMachine);
_navigationActor.start();

/** Get the module-level navigation actor for non-React access (bladeOpener, keyboard shortcuts). */
export function getNavigationActor(): NavigationActorRef {
  return _navigationActor;
}

/** @deprecated No longer needed — actor is a module-level singleton. Kept for test compatibility. */
export function setNavigationActor(_ref: NavigationActorRef | null): void {
  // no-op: actor is a module-level singleton
}

const NavigationActorContext =
  createContext<NavigationActorRef>(_navigationActor);

/** React hook to get the navigation actor ref. Must be used within NavigationProvider. */
export function useNavigationActorRef(): NavigationActorRef {
  return useContext(NavigationActorContext);
}

/** Provider that exposes the module-level navigation actor via React context. */
export function NavigationProvider({ children }: { children: ReactNode }) {
  return (
    <NavigationActorContext.Provider value={_navigationActor}>
      {children}
    </NavigationActorContext.Provider>
  );
}
