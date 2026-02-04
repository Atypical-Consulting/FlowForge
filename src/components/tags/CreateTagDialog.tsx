import { X } from "lucide-react";
import { useState } from "react";
import { commands } from "../../bindings";
import { getErrorMessage } from "../../lib/errors";

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
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-96">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Create Tag</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="tag-name"
              className="block text-sm text-gray-400 mb-1"
            >
              Tag name
            </label>
            <input
              id="tag-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="v1.0.0"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>

          <div>
            <label
              htmlFor="tag-message"
              className="block text-sm text-gray-400 mb-1"
            >
              Message (optional - leave empty for lightweight tag)
            </label>
            <textarea
              id="tag-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Release v1.0.0"
              rows={3}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isLoading}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
            >
              {isLoading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
