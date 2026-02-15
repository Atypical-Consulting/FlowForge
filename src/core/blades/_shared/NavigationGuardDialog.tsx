import { useSelector } from "@xstate/react";
import { AlertTriangle } from "lucide-react";
import { useNavigationActorRef } from "@/framework/layout/navigation/context";
import {
  selectIsConfirmingDiscard,
  selectDirtyBladeIds,
  selectBladeStack,
} from "@/framework/layout/navigation/selectors";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";

export function NavigationGuardDialog() {
  const actorRef = useNavigationActorRef();
  const isOpen = useSelector(actorRef, selectIsConfirmingDiscard);
  const dirtyBladeIds = useSelector(actorRef, selectDirtyBladeIds);
  const bladeStack = useSelector(actorRef, selectBladeStack);

  const dirtyTitles = bladeStack
    .filter((b) => !!dirtyBladeIds[b.id])
    .map((b) => b.title);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        actorRef.send({ type: "CANCEL_DISCARD" });
      }
    }}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-ctp-yellow shrink-0" />
            <DialogTitle>Unsaved Changes</DialogTitle>
          </div>
        </DialogHeader>
        <p className="text-sm text-ctp-subtext0">
          You have unsaved changes in{" "}
          <span className="font-medium text-ctp-text">
            {dirtyTitles.length > 0 ? dirtyTitles.join(", ") : "the current blade"}
          </span>{" "}
          that will be lost if you navigate away.
        </p>
        <DialogFooter className="mt-4">
          <Button
            variant="ghost"
            onClick={() => actorRef.send({ type: "CANCEL_DISCARD" })}
            autoFocus
          >
            Stay
          </Button>
          <Button
            className="bg-ctp-red text-ctp-base hover:bg-ctp-red/90"
            onClick={() => actorRef.send({ type: "CONFIRM_DISCARD" })}
          >
            Discard Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
