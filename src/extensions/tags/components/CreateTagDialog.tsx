import { useState } from "react";
import { Button } from "@/core/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/core/components/ui/dialog";
import { Input, Textarea } from "@/core/components/ui/input";
import { getErrorMessage } from "@/core/lib/errors";
import { commands } from "../../../bindings";

interface CreateTagDialogProps {
  onClose: () => void;
  onCreated: () => void;
}

export function CreateTagDialog({ onClose, onCreated }: CreateTagDialogProps) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);

    const result = await commands.createTag(
      name.trim(),
      message.trim() || null,
      null,
    );

    if (result.status === "ok") {
      onCreated();
      onClose();
    } else {
      setError(getErrorMessage(result.error));
    }
    setIsLoading(false);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Tag</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="tag-name"
              className="block text-sm text-ctp-overlay1 mb-1"
            >
              Tag name
            </label>
            <Input
              id="tag-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="v1.0.0"
            />
          </div>

          <div>
            <label
              htmlFor="tag-message"
              className="block text-sm text-ctp-overlay1 mb-1"
            >
              Message (optional - leave empty for lightweight tag)
            </label>
            <Textarea
              id="tag-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Release v1.0.0"
              rows={3}
            />
          </div>

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
