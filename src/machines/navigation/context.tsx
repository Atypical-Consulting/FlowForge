import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { createActor, type ActorRefFrom } from "xstate";
import { navigationMachine } from "./navigationMachine";

type NavigationActorRef = ActorRefFrom<typeof navigationMachine>;

// Module-level singleton actor
let _navigationActor: NavigationActorRef | null = null;

function createNavigationActor(): NavigationActorRef {
  const actor = createActor(navigationMachine);
  actor.start();
  return actor;
}

/** Get the module-level navigation actor for non-React access (bladeOpener, keyboard shortcuts). */
export function getNavigationActor(): NavigationActorRef {
  if (!_navigationActor) {
    throw new Error(
      "Navigation actor not initialized. Wrap app in NavigationProvider.",
    );
  }
  return _navigationActor;
}

/** Set or clear the module-level actor reference. Called by NavigationProvider. */
export function setNavigationActor(ref: NavigationActorRef | null): void {
  _navigationActor = ref;
}

const NavigationActorContext = createContext<NavigationActorRef | null>(null);

/** React hook to get the navigation actor ref. Must be used within NavigationProvider. */
export function useNavigationActorRef(): NavigationActorRef {
  const actorRef = useContext(NavigationActorContext);
  if (!actorRef) {
    throw new Error(
      "useNavigationActorRef must be used within NavigationProvider.",
    );
  }
  return actorRef;
}

/** Provider that creates and manages the navigation FSM actor. */
export function NavigationProvider({ children }: { children: ReactNode }) {
  const actorRef = useMemo(() => createNavigationActor(), []);

  useEffect(() => {
    setNavigationActor(actorRef);
    return () => {
      setNavigationActor(null);
      actorRef.stop();
    };
  }, [actorRef]);

  return (
    <NavigationActorContext.Provider value={actorRef}>
      {children}
    </NavigationActorContext.Provider>
  );
}
