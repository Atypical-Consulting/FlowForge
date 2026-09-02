import { useEffect, useMemo, useState } from "react";
import { Button } from "@/core/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/core/components/ui/dialog";
import { Input } from "@/core/components/ui/input";
import { useGitOpsStore as useBranchStore } from "../../../core/stores/domain/git-ops";
import { validateBranchName } from "../lib/validateBranchName";

interface CreateBranchDialogProps {
  onClose: () => void;
}

export function CreateBranchDialog({ onClose }: CreateBranchDialogProps) {
  const {
    createBranch,
    branchIsLoading: isLoading,
    // Mutation-scoped error: survives the branch list reloads that the file
    // watcher and other panels trigger while the dialog is open.
    branchMutationError: submitError,
    clearBranchMutationError,
  } = useBranchStore();
  const [name, setName] = useState("");
  const [checkout, setCheckout] = useState(true);

  // Do not show a stale error from an earlier operation when opening.
  useEffect(() => {
    clearBranchMutationError();
  }, [clearBranchMutationError]);

  const trimmedName = name.trim();
  const validationError = useMemo(
    () => (trimmedName ? validateBranchName(trimmedName) : null),
    [trimmedName],
  );
  const error = validationError ?? submitError;

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    if (submitError) clearBranchMutationError();
  };

  const handleClose = () => {
    clearBranchMutationError();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmedName || validationError || isLoading) return;
    const result = await createBranch(trimmedName, checkout);
    if (result) {
      onClose();
    }
  };

  return (
    <Dialog open={true} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Branch</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="branch-name"
              className="block text-sm text-ctp-overlay1 mb-1"
            >
              Branch name
            </label>
            <Input
              id="branch-name"
              type="text"
              value={name}
              onChange={handleNameChange}
              placeholder="feature/my-feature"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "branch-name-error" : undefined}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={checkout}
              onChange={(e) => setCheckout(e.target.checked)}
              className="rounded"
            />
            <span>Switch to new branch after creation</span>
          </label>

          {error && (
            <p
              id="branch-name-error"
              role="alert"
              className="text-ctp-red text-sm"
            >
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!trimmedName || !!validationError || isLoading}
            >
              {isLoading ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
