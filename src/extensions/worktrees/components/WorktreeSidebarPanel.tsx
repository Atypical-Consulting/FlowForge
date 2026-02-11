import { useEffect, useState } from "react";
import { WorktreePanel } from "./WorktreePanel";
import { CreateWorktreeDialog } from "./CreateWorktreeDialog";
import { DeleteWorktreeDialog } from "./DeleteWorktreeDialog";

export function WorktreeSidebarPanel() {
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Listen for CustomEvent from renderAction "+" button
  useEffect(() => {
    const handler = () => setShowCreate(true);
    document.addEventListener("worktree:open-create-dialog", handler);
    return () => document.removeEventListener("worktree:open-create-dialog", handler);
  }, []);

  return (
    <>
      <WorktreePanel onOpenDeleteDialog={setDeleteTarget} />
      <CreateWorktreeDialog
        open={showCreate}
        onOpenChange={setShowCreate}
      />
      <DeleteWorktreeDialog
        worktreeName={deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      />
    </>
  );
}
