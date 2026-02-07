import { Loader2 } from "lucide-react";

export function BladeLoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-5 h-5 animate-spin text-ctp-overlay1" />
    </div>
  );
}
