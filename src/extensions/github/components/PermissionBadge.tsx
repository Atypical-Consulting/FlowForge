import { cn } from "../../../lib/utils";

const PERMISSION_STYLES: Record<string, { bg: string; text: string }> = {
  network: { bg: "bg-ctp-blue/15", text: "text-ctp-blue" },
  filesystem: { bg: "bg-ctp-yellow/15", text: "text-ctp-yellow" },
  "git-operations": { bg: "bg-ctp-green/15", text: "text-ctp-green" },
};

interface PermissionBadgeProps {
  permission: string;
}

export function PermissionBadge({ permission }: PermissionBadgeProps) {
  const style = PERMISSION_STYLES[permission] ?? {
    bg: "bg-ctp-surface1",
    text: "text-ctp-subtext0",
  };

  return (
    <span
      className={cn(
        "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
        style.bg,
        style.text,
      )}
    >
      {permission}
    </span>
  );
}
