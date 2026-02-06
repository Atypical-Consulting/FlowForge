import { convertFileSrc } from "@tauri-apps/api/core";
import { ImageIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useRepositoryStore } from "../../stores/repository";

interface ViewerImageBladeProps {
  filePath: string;
}

export function ViewerImageBlade({ filePath }: ViewerImageBladeProps) {
  const repoPath = useRepositoryStore((s) => s.status?.repoPath);
  const [loadError, setLoadError] = useState(false);

  // Build an asset URL from the absolute file path
  const src = useMemo(() => {
    if (!repoPath) return null;
    const absPath = `${repoPath}/${filePath}`;
    return convertFileSrc(absPath);
  }, [repoPath, filePath]);

  if (!src || loadError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-ctp-mantle gap-2">
        <ImageIcon className="w-8 h-8 text-ctp-overlay0" />
        <p className="text-ctp-overlay1 text-sm">
          {loadError ? "Failed to load image" : "Image preview not available"}
        </p>
        <p className="text-ctp-overlay0 text-xs">{filePath}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-ctp-surface0 bg-ctp-crust shrink-0">
        <ImageIcon className="w-4 h-4 text-ctp-overlay1" />
        <span className="text-sm text-ctp-subtext1 truncate flex-1">
          {filePath}
        </span>
      </div>

      {/* Image */}
      <div className="flex-1 min-h-0 flex items-center justify-center bg-ctp-mantle p-4 overflow-auto">
        <img
          src={src}
          alt={filePath.split("/").pop() || "Image"}
          className="max-w-full max-h-full object-contain rounded shadow-lg"
          onError={() => setLoadError(true)}
        />
      </div>
    </div>
  );
}
