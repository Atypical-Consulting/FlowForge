import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { ConventionalCommitForm } from "./ConventionalCommitForm";

interface ConventionalCommitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCommit: (message: string) => void;
  disabled?: boolean;
}

export function ConventionalCommitModal({
  open,
  onOpenChange,
  onCommit,
  disabled,
}: ConventionalCommitModalProps) {
  const handleCommit = (message: string) => {
    onCommit(message);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Conventional Commit</DialogTitle>
        </DialogHeader>
        <ConventionalCommitForm
          onCommit={handleCommit}
          onCancel={() => onOpenChange(false)}
          disabled={disabled}
        />
      </DialogContent>
    </Dialog>
  );
}
