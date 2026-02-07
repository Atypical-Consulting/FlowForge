import { FileText } from "lucide-react";
import { useEffect, useRef } from "react";
import { useRepoFile } from "../../hooks/useRepoFile";
import { BladeContentLoading } from "./BladeContentLoading";
import { BladeContentError } from "./BladeContentError";
import { BladeContentEmpty } from "./BladeContentEmpty";
import { MarkdownRenderer } from "../markdown/MarkdownRenderer";

interface ViewerMarkdownBladeProps {
  filePath: string;
}

export function ViewerMarkdownBlade({ filePath }: ViewerMarkdownBladeProps) {
  const { data, isLoading, error, refetch } = useRepoFile(filePath);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus management: after mounting (including after replaceBlade navigation),
  // move focus to the content container for keyboard users.
  useEffect(() => {
    containerRef.current?.focus();
  }, [filePath]);

  if (isLoading) {
    return <BladeContentLoading />;
  }

  if (error) {
    return (
      <BladeContentError
        message="Failed to load markdown"
        detail={error.message}
        onRetry={() => refetch()}
      />
    );
  }

  if (!data || data.isBinary) {
    return (
      <BladeContentEmpty
        icon={FileText}
        message="File not found at HEAD"
        detail={filePath}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      className="flex-1 overflow-y-auto h-full bg-ctp-base outline-none"
    >
      <div className="p-6 max-w-3xl mx-auto">
        <MarkdownRenderer
          content={data.content}
          currentFilePath={filePath}
        />
      </div>
    </div>
  );
}
