import { FileText } from "lucide-react";
import { useRepoFile } from "../../hooks/useRepoFile";
import { BladeContentLoading } from "../_shared/BladeContentLoading";
import { BladeContentError } from "../_shared/BladeContentError";
import { BladeContentEmpty } from "../_shared/BladeContentEmpty";

interface ViewerPlaintextBladeProps {
  filePath: string;
}

export function ViewerPlaintextBlade({ filePath }: ViewerPlaintextBladeProps) {
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

  if (!data || data.isBinary) {
    return (
      <BladeContentEmpty
        icon={FileText}
        message={data?.isBinary ? "Binary file" : "File not found"}
        detail={filePath}
      />
    );
  }

  return (
    <pre className="flex-1 overflow-auto p-4 bg-ctp-base text-ctp-text text-sm font-mono whitespace-pre-wrap break-words leading-relaxed">
      {data.content}
    </pre>
  );
}
