import { cn } from "../../lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "motion-safe:animate-pulse rounded bg-ctp-surface0",
        className,
      )}
    />
  );
}
