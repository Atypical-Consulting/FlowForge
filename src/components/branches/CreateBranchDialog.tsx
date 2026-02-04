import { X } from "lucide-react";
import { useState } from "react";
import { useBranchStore } from "../../stores/branches";

interface CreateBranchDialogProps {
  onClose: () => void;
}

export function CreateBranchDialog({ onClose }: CreateBranchDialogProps) {
  const { createBranch, isLoading, error } = useBranchStore();
  const [name, setName] = useState("");
  const [checkout, setCheckout] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const result = await createBranch(name.trim(), checkout);
    if (result) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-ctp-mantle border border-ctp-surface1 rounded-lg p-6 w-96">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Create Branch</h3>
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
              htmlFor="branch-name"
              className="block text-sm text-ctp-overlay1 mb-1"
            >
              Branch name
            </label>
            <input
              id="branch-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="feature/my-feature"
              className="w-full px-3 py-2 bg-ctp-surface0 border border-ctp-surface1 rounded focus:outline-none focus:border-ctp-blue"
              autoFocus
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
