import { useBladeNavigation } from "../../hooks/useBladeNavigation";
import { CommitHistory } from "../../components/commit/CommitHistory";

export function CommitListFallbackBlade() {
  const { openBlade } = useBladeNavigation();

  return (
    <div className="flex flex-col h-full">
      <CommitHistory onCommitSelect={(oid) => openBlade("commit-details", { oid })} />
    </div>
  );
}
