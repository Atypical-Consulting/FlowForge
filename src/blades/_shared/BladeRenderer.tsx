import { Suspense } from "react";
import { getBladeRegistration } from "../../lib/bladeRegistry";
import { BladePanel } from "./BladePanel";
import { BladeLoadingFallback } from "./BladeLoadingFallback";
import { BladeErrorBoundary } from "./BladeErrorBoundary";
import type { TypedBlade } from "../../stores/bladeTypes";

interface BladeRendererProps {
  blade: TypedBlade;
  goBack: () => void;
}

export function BladeRenderer({ blade, goBack }: BladeRendererProps) {
  const reg = getBladeRegistration(blade.type);
  if (!reg)
    return (
      <div className="p-4 text-ctp-red">Unknown blade: {blade.type}</div>
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
