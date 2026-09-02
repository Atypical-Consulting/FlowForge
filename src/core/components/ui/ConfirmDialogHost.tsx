import { AlertTriangle } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { useConfirmStore } from "@/framework/stores/confirm";
import { Button } from "./button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "./dialog";

/**
 * Renders the confirmation requested through `confirm()` from
 * `@/framework/stores/confirm`. Mount exactly once, near the other global
 * overlays in App.
 */
export function ConfirmDialogHost() {
  const pending = useConfirmStore((s) => s.pending);
  const settle = useConfirmStore((s) => s.settle);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const open = pending !== null;

  const handleOpenChange = useCallback(
    (next: boolean) => {
      // Escape, backdrop click and the close affordance all count as cancel.
      if (!next) settle(false);
    },
    [settle],
  );

  // DialogContent focuses its first focusable child (the Cancel button) in
  // its own effect. Child effects run before parent effects, so focusing the
  // primary action here wins: Enter confirms, Escape cancels.
  useEffect(() => {
    if (pending) confirmRef.current?.focus();
  }, [pending]);

  const titleId = pending ? `${pending.id}-title` : undefined;
  const descriptionId = pending?.description
    ? `${pending.id}-description`
    : undefined;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        size="sm"
        role="alertdialog"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        {pending && (
          <>
            <div className="flex items-start gap-3 mb-5">
              {pending.danger && (
                <AlertTriangle
                  className="w-5 h-5 text-ctp-red shrink-0 mt-0.5"
                  aria-hidden="true"
                />
              )}
              <div className="min-w-0">
                <DialogTitle id={titleId}>{pending.title}</DialogTitle>
                {pending.description && (
                  <p
                    id={descriptionId}
                    className="mt-2 text-sm text-ctp-subtext0 whitespace-pre-line"
                  >
                    {pending.description}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => settle(false)}>
                {pending.cancelLabel ?? "Cancel"}
              </Button>
              <Button
                ref={confirmRef}
                variant={pending.danger ? "destructive" : "default"}
                onClick={() => settle(true)}
              >
                {pending.confirmLabel ?? "Confirm"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
