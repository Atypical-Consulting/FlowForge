import { type ActorRefFrom, createActor } from "xstate";
import { mergeMachine } from "./mergeMachine";

export type MergeActorRef = ActorRefFrom<typeof mergeMachine>;

// Module-level singleton actor — lives outside React lifecycle so it survives
// StrictMode double-mount and component re-renders without being stopped.
const _mergeActor: MergeActorRef = createActor(mergeMachine);
_mergeActor.start();

/** Get the module-level merge actor for non-React access. */
export function getMergeActor(): MergeActorRef {
  return _mergeActor;
}
