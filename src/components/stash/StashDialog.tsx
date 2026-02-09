import { useState } from "react";
import { useStashStore } from "../../stores/stash";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";

interface StashDialogProps {
  onClose: () => void;
}

export function StashDialog({ onClose }: StashDialogProps) {
  const { saveStash, stashIsLoading: isLoading, stashError: error } = useStashStore();
  const [message, setMessage] = useState("");
  const [includeUntracked, setIncludeUntracked] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await saveStash(message || null, includeUntracked);
    if (success) onClose();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Stash Changes</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="stash-message"
              className="block text-sm text-ctp-overlay1 mb-1"
            >
              Message (optional)
            </label>
            <Input
              id="stash-message"
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="WIP: description"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeUntracked}
              onChange={(e) => setIncludeUntracked(e.target.checked)}
              className="rounded"
            />
            <span>Include untracked files</span>
          </label>

          {error && <p className="text-ctp-red text-sm">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Stashing..." : "Stash"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
