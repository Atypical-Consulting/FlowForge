import { useStagingStore } from "../../stores/staging";
import { getViewerForFile, registerViewer } from "./ViewerRegistry";
import { DiffViewer } from "./DiffViewer";
import { NugetPackageViewer } from "./NugetPackageViewer";

// Register viewers on module load
// NuGet viewer: matches .nupkg files with high priority
registerViewer(
  (file) => file.path.toLowerCase().endsWith(".nupkg"),
  NugetPackageViewer,
  100
);

// Default diff viewer: matches all files as fallback (priority 0)
registerViewer(() => true, DiffViewer, 0);

export function FileViewer() {
  const { selectedFile, selectedSection } = useStagingStore();

  if (!selectedFile) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900">
        <p className="text-gray-500 text-sm">Select a file to view</p>
      </div>
    );
  }

  const Viewer = getViewerForFile(selectedFile);

  if (!Viewer) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900">
        <p className="text-gray-500 text-sm">
          No viewer available for this file type
        </p>
      </div>
    );
  }

  return <Viewer file={selectedFile} section={selectedSection} />;
}
