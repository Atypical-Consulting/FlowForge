import { useBladeNavigation } from "@/core/hooks/useBladeNavigation";
import { CommitHistory } from "@/extensions/commits/components/CommitHistory";

export function CommitListFallbackBlade() {
  const { openBlade } = useBladeNavigation();

  return (
    <div className="flex flex-col h-full">
      <CommitHistory onCommitSelect={(oid) => openBlade("commit-details", { oid })} />
    </div>
  );
}
