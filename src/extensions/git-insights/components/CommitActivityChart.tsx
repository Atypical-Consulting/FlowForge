import type { DailyCommitCount } from "../types";

interface Props {
  data: DailyCommitCount[];
}

export function CommitActivityChart({ data }: Props) {
  return (
    <div className="text-xs text-ctp-subtext0 text-center py-4">
      Loading chart ({data.length} data points)...
    </div>
  );
}
