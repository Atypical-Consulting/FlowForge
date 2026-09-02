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
import { useGitOpsStore as useBranchStore } from "../../../core/stores/domain/git-ops";

interface CreateBranchDialogProps {
  onClose: () => void;
}

export function CreateBranchDialog({ onClose }: CreateBranchDialogProps) {
  const {
    createBranch,
    branchIsLoading: isLoading,
    branchError: error,
  } = useBranchStore();
  const [name, setName] = useState("");
  const [checkout, setCheckout] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isLoading) return;
    const result = await createBranch(name.trim(), checkout);
    if (result) {
      onClose();
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
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
              onChange={(e) => setName(e.target.value)}
              placeholder="feature/my-feature"
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

          {error && <p className="text-ctp-red text-sm">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isLoading}>
              {isLoading ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
