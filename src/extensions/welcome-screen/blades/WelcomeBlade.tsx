import { useSelector } from "@xstate/react";
import { BladeRenderer } from "@/framework/layout/BladeRenderer";
import { useNavigationActorRef } from "@/framework/layout/navigation/context";
import { selectBladeStack } from "@/framework/layout/navigation/selectors";
import { WelcomeContent } from "../components/WelcomeContent";

export function WelcomeBlade() {
  // Watch navigation blade stack for blades pushed while on WelcomeView
  // (e.g. Settings, Extension Manager from command palette or toolbar)
  const actorRef = useNavigationActorRef();
  const bladeStack = useSelector(actorRef, selectBladeStack);
  const pushedBlade = bladeStack.length > 1 ? bladeStack[bladeStack.length - 1] : null;

  // Show blades pushed via command palette / toolbar while on WelcomeView
  if (pushedBlade) {
    return (
      <div className="h-[calc(100vh-3.5rem)] bg-ctp-base">
        <BladeRenderer
          blade={pushedBlade}
          goBack={() => actorRef.send({ type: "POP_BLADE" })}
        />
      </div>
    );
  }

  return <WelcomeContent />;
}
