import { Box } from "lucide-react";

interface Viewer3dBladeProps {
  filePath: string;
}

export function Viewer3dBlade({ filePath }: Viewer3dBladeProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-ctp-subtext0">
      <Box className="w-12 h-12 text-ctp-overlay0" />
      <p className="text-sm">3D model viewer for</p>
      <code className="text-xs bg-ctp-surface0 px-2 py-1 rounded font-mono">
        {filePath}
      </code>
      <p className="text-xs text-ctp-overlay0">Coming in Phase 22</p>
    </div>
  );
}
