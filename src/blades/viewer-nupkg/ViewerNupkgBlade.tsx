import { NugetPackageViewer } from "../../components/viewers/NugetPackageViewer";
import type { FileChange } from "../../bindings";

interface ViewerNupkgBladeProps {
  filePath: string;
}

export function ViewerNupkgBlade({ filePath }: ViewerNupkgBladeProps) {
  // Build a minimal FileChange for the NugetPackageViewer
  const file: FileChange = {
    path: filePath,
    status: "modified",
    additions: null,
    deletions: null,
  };

  return <NugetPackageViewer file={file} section={null} />;
}
