import { FolderTree } from "lucide-react";

interface RepoBrowserBladeProps {
  path?: string;
}

export function RepoBrowserBlade({ path }: RepoBrowserBladeProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-ctp-subtext0">
      <FolderTree className="w-12 h-12 text-ctp-overlay0" />
      <p className="text-sm">Repository file browser</p>
      {path && (
        <code className="text-xs bg-ctp-surface0 px-2 py-1 rounded font-mono">
          {path}
        </code>
      )}
      <p className="text-xs text-ctp-overlay0">Coming in Phase 22</p>
    </div>
  );
}
