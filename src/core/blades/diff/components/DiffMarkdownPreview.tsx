import { lazy, Suspense } from "react";
import { BladeLoadingFallback } from "@/framework/layout/BladeLoadingFallback";

const MarkdownRenderer = lazy(() =>
  import("../../../components/markdown/MarkdownRenderer").then((m) => ({
    default: m.MarkdownRenderer,
  })),
);

interface DiffMarkdownPreviewProps {
  content: string;
  filePath: string;
}

export function DiffMarkdownPreview({
  content,
  filePath,
}: DiffMarkdownPreviewProps) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-ctp-base">
      <div className="p-6 mx-auto w-full">
        <Suspense fallback={<BladeLoadingFallback />}>
          <MarkdownRenderer content={content} currentFilePath={filePath} />
        </Suspense>
      </div>
    </div>
  );
}
