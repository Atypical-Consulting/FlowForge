import { useBladeNavigation } from "../../hooks/useBladeNavigation";
import { StagingPanel } from "../staging/StagingPanel";

export function StagingChangesBlade() {
  const { openStagingDiff } = useBladeNavigation();
  return <StagingPanel onFileSelect={openStagingDiff} />;
}
