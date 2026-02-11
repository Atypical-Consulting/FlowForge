import { Plus } from "lucide-react";
import { useState } from "react";
import { BranchList } from "../../components/branches/BranchList";

export function BranchManagerBlade() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-end gap-2 px-3 py-2 border-b border-ctp-surface0 bg-ctp-mantle shrink-0">
        <button
          type="button"
          onClick={() => setShowCreateDialog(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-ctp-blue text-ctp-base hover:bg-ctp-blue/80 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Branch
        </button>
      </div>
      <BranchList
        showCreateDialog={showCreateDialog}
        onCloseCreateDialog={() => setShowCreateDialog(false)}
      />
    </div>
  );
}
