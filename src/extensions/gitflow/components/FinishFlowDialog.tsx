import { useState } from "react";
import { Button } from "@/core/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/core/components/ui/dialog";
import { Input } from "@/core/components/ui/input";
import { useGitOpsStore as useGitflowStore } from "../../../core/stores/domain/git-ops";
import { useGitflowWorkflow } from "../hooks/useGitflowWorkflow";
import { ReviewChecklist } from "./ReviewChecklist";

interface FinishFlowDialogProps {
  flowType: "feature" | "release" | "hotfix";
  onClose: () => void;
}

export function FinishFlowDialog({ flowType, onClose }: FinishFlowDialogProps) {
  const { gitflowStatus: status } = useGitflowStore();
  const { isBusy: isLoading, error, finishOperation } = useGitflowWorkflow();
  const [tagMessage, setTagMessage] = useState("");

  const needsTagMessage = flowType === "release" || flowType === "hotfix";
  const flowName = status?.activeFlow?.name || "";

  const getDescription = () => {
    switch (flowType) {
      case "feature":
        return (
          <>
            Merge{" "}
            <code className="text-ctp-blue bg-ctp-surface0 px-1 rounded">
              feature/{flowName}
            </code>{" "}
            into develop
          </>
        );
      case "release":
        return (
          <>
            Merge{" "}
            <code className="text-ctp-blue bg-ctp-surface0 px-1 rounded">
              release/{flowName}
            </code>{" "}
            into main and develop, create tag
          </>
        );
      case "hotfix":
        return (
          <>
            Merge{" "}
            <code className="text-ctp-blue bg-ctp-surface0 px-1 rounded">
              hotfix/{flowName}
            </code>{" "}
            into main and develop, create tag
          </>
        );
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    finishOperation(flowType, tagMessage || undefined);
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Finish {flowType.charAt(0).toUpperCase() + flowType.slice(1)}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogDescription>{getDescription()}</DialogDescription>

          <ReviewChecklist flowType={flowType} />

          {needsTagMessage && (
            <div>
              <label
                htmlFor="tag-message"
                className="block text-sm text-ctp-overlay1 mb-1.5"
              >
                Tag message (optional)
              </label>
              <Input
                id="tag-message"
                type="text"
                value={tagMessage}
                onChange={(e) => setTagMessage(e.target.value)}
                placeholder={
                  flowType === "release"
                    ? `Release ${flowName}`
                    : `Hotfix ${flowName}`
                }
              />
            </div>
          )}

          {error && <p className="text-ctp-red text-sm">{error}</p>}

          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-ctp-green hover:bg-ctp-green/90"
            >
              {isLoading ? "Finishing..." : "Finish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
