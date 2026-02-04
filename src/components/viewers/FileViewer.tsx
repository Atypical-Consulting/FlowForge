import { useStagingStore } from "../../stores/staging";
import { DiffViewer } from "./DiffViewer";
import { NugetPackageViewer } from "./NugetPackageViewer";
import { getViewerForFile, registerViewer } from "./ViewerRegistry";

// Register viewers on module load
// NuGet viewer: matches .nupkg files with high priority
registerViewer(
  (file) => file.path.toLowerCase().endsWith(".nupkg"),
  NugetPackageViewer,
  100,
);

// Default diff viewer: matches all files as fallback (priority 0)
registerViewer(() => true, DiffViewer, 0);

export function FileViewer() {
  const { selectedFile, selectedSection } = useStagingStore();

  if (!selectedFile) {
    return (
      <div className="flex-1 flex items-center justify-center bg-ctp-mantle">
        <p className="text-ctp-overlay0 text-sm">Select a file to view</p>
      </div>
    );
  }

  const Viewer = getViewerForFile(selectedFile);

  if (!Viewer) {
    return (
      <div className="flex-1 flex items-center justify-center bg-ctp-mantle">
        <p className="text-ctp-overlay0 text-sm">
          No viewer available for this file type
        </p>
      </div>
    );
  }

  return <Viewer file={selectedFile} section={selectedSection} />;
}
