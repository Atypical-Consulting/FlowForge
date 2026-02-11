import { Suspense } from "react";
import { Puzzle } from "lucide-react";
import { useBladeRegistry } from "../../lib/bladeRegistry";
import { openBlade } from "../../lib/bladeOpener";
import { BladePanel } from "./BladePanel";
import { BladeLoadingFallback } from "./BladeLoadingFallback";
import { BladeErrorBoundary } from "./BladeErrorBoundary";
import type { TypedBlade } from "../../stores/bladeTypes";

interface BladeRendererProps {
  blade: TypedBlade;
  goBack: () => void;
}

export function BladeRenderer({ blade, goBack }: BladeRendererProps) {
  const reg = useBladeRegistry((s) => s.blades.get(blade.type));
  if (!reg)
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <Puzzle className="w-10 h-10 text-ctp-overlay0 opacity-50" />
        <p className="text-sm text-ctp-subtext0 text-center">
          This content requires an extension that is currently disabled.
        </p>
        <button
          type="button"
          onClick={() => openBlade("extension-manager", {})}
          className="text-xs text-ctp-blue hover:underline cursor-pointer"
        >
          Open Extension Manager
        </button>
      </div>
    );

  const Component = reg.component;
  const title =
    typeof reg.defaultTitle === "function"
      ? reg.defaultTitle(blade.props as any)
      : blade.title || reg.defaultTitle;

  let content = <Component {...(blade.props as any)} />;

  if (reg.lazy) {
    content = (
      <Suspense fallback={<BladeLoadingFallback />}>{content}</Suspense>
    );
  }

  content = (
    <BladeErrorBoundary bladeTitle={title} onBack={goBack}>
      {content}
    </BladeErrorBoundary>
  );

  if (reg.wrapInPanel !== false) {
    content = (
      <BladePanel
        title={title}
        titleContent={reg.renderTitleContent?.(blade.props as any)}
        trailing={reg.renderTrailing?.(blade.props as any, { goBack })}
        showBack={reg.showBack !== false}
        onBack={goBack}
      >
        {content}
      </BladePanel>
    );
  }

  return content;
}
