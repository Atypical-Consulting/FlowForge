import { createActor, type ActorRefFrom } from "xstate";
import { gitflowMachine } from "./gitflowMachine";

export type GitflowActorRef = ActorRefFrom<typeof gitflowMachine>;

// Module-level singleton actor — lives outside React lifecycle so it survives
// StrictMode double-mount and component re-renders without being stopped.
const _gitflowActor: GitflowActorRef = createActor(gitflowMachine);
_gitflowActor.start();

/** Get the module-level gitflow actor for non-React access. */
export function getGitflowActor(): GitflowActorRef {
  return _gitflowActor;
}
