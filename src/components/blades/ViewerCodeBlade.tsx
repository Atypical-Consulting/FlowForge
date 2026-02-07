import { Editor } from "@monaco-editor/react";
import { FileCode } from "lucide-react";
import { useRepoFile } from "../../hooks/useRepoFile";
import { MONACO_COMMON_OPTIONS, MONACO_THEME } from "../../lib/monacoConfig";
import "../../lib/monacoTheme";
import { BladeContentLoading } from "./BladeContentLoading";
import { BladeContentError } from "./BladeContentError";
import { BladeContentEmpty } from "./BladeContentEmpty";

interface ViewerCodeBladeProps {
  filePath: string;
}

export function ViewerCodeBlade({ filePath }: ViewerCodeBladeProps) {
  const { data, isLoading, error, refetch } = useRepoFile(filePath);

  if (isLoading) {
    return <BladeContentLoading />;
  }

  if (error) {
    return (
      <BladeContentError
        message="Failed to load file"
        detail={error.message}
        onRetry={() => refetch()}
      />
    );
  }

  if (!data) {
    return (
      <BladeContentEmpty
        icon={FileCode}
        message="File not found at HEAD"
        detail={filePath}
      />
    );
  }

  // Binary file — show info card instead of garbled content
  if (data.isBinary) {
    const sizeLabel = formatFileSize(data.size);
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-ctp-mantle gap-3">
        <FileCode className="w-10 h-10 text-ctp-overlay0" />
        <p className="text-sm text-ctp-subtext0">Binary file — preview not available</p>
        <p className="text-xs text-ctp-overlay0">{filePath}</p>
        <p className="text-xs text-ctp-overlay0">{sizeLabel}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0">
      <Editor
        value={data.content}
        path={filePath}
        theme={MONACO_THEME}
        options={MONACO_COMMON_OPTIONS}
      />
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
