import { open } from "@tauri-apps/plugin-dialog";
import { Folder } from "lucide-react";
import { useEffect, useState } from "react";
import { useGitOpsStore as useBranchStore } from "../../../stores/domain/git-ops";
import { useGitOpsStore as useWorktreeStore } from "../../../stores/domain/git-ops";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";

interface CreateWorktreeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateWorktreeDialog({
  open: isOpen,
  onOpenChange,
}: CreateWorktreeDialogProps) {
  const { branchList: branches, loadBranches } = useBranchStore();
  const { createWorktree, worktreeIsLoading: isLoading, worktreeError: error, clearWorktreeError: clearError } = useWorktreeStore();

  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [createNewBranch, setCreateNewBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");

  // Load branches when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadBranches();
      clearError();
    }
  }, [isOpen, loadBranches, clearError]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setName("");
      setPath("");
      setSelectedBranch("");
      setCreateNewBranch(false);
      setNewBranchName("");
    }
  }, [isOpen]);

  const handleSelectDirectory = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select Worktree Location",
    });
    if (selected && typeof selected === "string") {
      setPath(selected);
      // Auto-fill name from directory name if empty
      if (!name) {
        const dirName = selected.split(/[/\\]/).pop() || "";
        setName(dirName);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !path.trim()) return;

    const result = await createWorktree({
      name: name.trim(),
      path: path.trim(),
      branch: createNewBranch ? newBranchName.trim() || null : selectedBranch || null,
      createBranch: createNewBranch,
    });

    if (result) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Worktree</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Worktree Name */}
          <div>
            <label
              htmlFor="wt-name"
              className="block text-sm text-ctp-subtext0 mb-1"
            >
              Worktree Name
            </label>
            <Input
              id="wt-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="feature-worktree"
              autoFocus
            />
          </div>

          {/* Directory Selection */}
          <div>
            <label className="block text-sm text-ctp-subtext0 mb-1">
              Directory
            </label>
            <div className="flex gap-2">
              <Input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/path/to/worktree"
                className="flex-1"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleSelectDirectory}
              >
                <Folder className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Branch Selection */}
          <div>
            <label className="block text-sm text-ctp-subtext0 mb-1">
              Branch
            </label>

            <label className="flex items-center gap-2 text-sm mb-2">
              <input
                type="checkbox"
                checked={createNewBranch}
                onChange={(e) => setCreateNewBranch(e.target.checked)}
                className="rounded"
              />
              <span>Create new branch</span>
            </label>

            {createNewBranch ? (
              <Input
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="new-branch-name"
              />
            ) : (
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full px-3 py-2 bg-ctp-surface0 border border-ctp-surface1 rounded text-sm focus:outline-none focus:border-ctp-blue"
              >
                <option value="">Use current HEAD</option>
                {branches.map((branch) => (
                  <option key={branch.name} value={branch.name}>
                    {branch.name}
                    {branch.isHead && " (current)"}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Error Display */}
          {error && <p className="text-ctp-red text-sm">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || !path.trim() || isLoading}
            >
              {isLoading ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
