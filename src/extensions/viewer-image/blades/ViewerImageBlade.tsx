import { ImageIcon, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { commands } from "../../../bindings";
import { getErrorMessage } from "../../../core/lib/errors";

interface ViewerImageBladeProps {
  filePath: string;
  /** If provided, load image from this commit; otherwise load from working tree */
  oid?: string;
}

export function ViewerImageBlade({ filePath, oid }: ViewerImageBladeProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSrc(null);

    const load = async () => {
      const result = oid
        ? await commands.getCommitFileBase64(oid, filePath)
        : await commands.getFileBase64(filePath);

      if (cancelled) return;

      if (result.status === "ok") {
        setSrc(result.data);
      } else {
        setError(getErrorMessage(result.error));
      }
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [filePath, oid]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-ctp-mantle">
        <Loader2 className="w-6 h-6 animate-spin text-ctp-overlay0" />
      </div>
    );
  }

  if (error || !src) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-ctp-mantle gap-2">
        <ImageIcon className="w-8 h-8 text-ctp-overlay0" />
        <p className="text-ctp-overlay1 text-sm">
          {error || "Image preview not available"}
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
        />
      </div>
    </div>
  );
}
