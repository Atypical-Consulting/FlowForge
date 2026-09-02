import { useState } from "react";
import { Button } from "@/core/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/core/components/ui/dialog";
import { Input } from "@/core/components/ui/input";
import { useGitflowWorkflow } from "../hooks/useGitflowWorkflow";

interface StartFlowDialogProps {
  flowType: "feature" | "release" | "hotfix";
  onClose: () => void;
}

const config = {
  feature: {
    title: "Start Feature",
    label: "Feature name",
    placeholder: "my-feature-name",
    prefix: "feature/",
  },
  release: {
    title: "Start Release",
    label: "Version",
    placeholder: "1.0.0",
    prefix: "release/",
  },
  hotfix: {
    title: "Start Hotfix",
    label: "Hotfix name",
    placeholder: "fix-critical-bug",
    prefix: "hotfix/",
  },
};

export function StartFlowDialog({ flowType, onClose }: StartFlowDialogProps) {
  const { isBusy: isLoading, error, startOperation } = useGitflowWorkflow();
  const [name, setName] = useState("");
  // Only surface failures of the operation submitted from this dialog, not a
  // stale error left over from an earlier one (the panel shows that).
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const { title, label, placeholder, prefix } = config[flowType];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isLoading) return;
    setHasSubmitted(true);
    // Stay open while the machine runs and refreshes; close only on success
    // so a failure is shown right here instead of vanishing with the dialog.
    const succeeded = await startOperation(flowType, name.trim());
    if (succeeded) onClose();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="flow-name"
              className="block text-sm text-ctp-overlay1 mb-1.5"
            >
              {label}
            </label>
            <Input
              id="flow-name"
              type="text"
              value={name}
              onChange={(e) => {
                // Sanitize: replace spaces with dashes, remove invalid chars
                const sanitized = e.target.value
                  .replace(/\s+/g, "-")
                  .replace(/[^a-zA-Z0-9._-]/g, "");
                setName(sanitized);
              }}
              placeholder={placeholder}
            />
            <p className="text-xs text-ctp-overlay0 mt-1.5">
              Branch will be created as{" "}
              <code className="text-ctp-overlay1">
                {prefix}
                {name || "..."}
              </code>
            </p>
          </div>

          {hasSubmitted && error && (
            <p role="alert" className="text-ctp-red text-sm">
              {error}
            </p>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isLoading}>
              {isLoading ? "Starting..." : "Start"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
