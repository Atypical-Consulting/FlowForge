import type { FileChange } from "../../../bindings";
import { NugetPackageViewer } from "../components/NugetPackageViewer";

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
