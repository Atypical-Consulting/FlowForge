import { X } from "lucide-react";
import { useState } from "react";
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
    if (!name.trim()) return;

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-ctp-mantle border border-ctp-surface1 rounded-lg p-6 w-96">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Create Tag</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-ctp-surface0 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="tag-name"
              className="block text-sm text-ctp-overlay1 mb-1"
            >
              Tag name
            </label>
            <input
              id="tag-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="v1.0.0"
              className="w-full px-3 py-2 bg-ctp-surface0 border border-ctp-surface1 rounded focus:outline-none focus:border-ctp-blue"
            />
          </div>

          <div>
            <label
              htmlFor="tag-message"
              className="block text-sm text-ctp-overlay1 mb-1"
            >
              Message (optional - leave empty for lightweight tag)
            </label>
            <textarea
              id="tag-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Release v1.0.0"
              rows={3}
              className="w-full px-3 py-2 bg-ctp-surface0 border border-ctp-surface1 rounded focus:outline-none focus:border-ctp-blue resize-none"
            />
          </div>

          {error && <p className="text-ctp-red text-sm">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-ctp-overlay1 hover:text-ctp-text"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isLoading}
              className="px-4 py-2 text-sm bg-ctp-blue hover:bg-ctp-blue/80 rounded disabled:opacity-50"
            >
              {isLoading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
