import {
  GitBranch,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  ExternalLink,
} from "lucide-react";
import type { BranchHealthInfo } from "../types";
import { commands } from "../../../bindings";
import { toast } from "@/framework/stores/toast";
import { useInsightsStore } from "../insightsStore";

interface Props {
  branches: BranchHealthInfo[];
}

const MAX_SHOWN = 20;

function formatRelativeDate(timestampMs: number): string {
  const seconds = Math.floor((Date.now() - timestampMs) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

async function handleCheckout(name: string) {
  try {
    const result = await commands.checkoutBranch(name);
    if (result.status === "error") {
      const errMsg =
        "message" in result.error
          ? String(result.error.message)
          : result.error.type;
      toast.error(`Checkout failed: ${errMsg}`);
      return;
    }
    toast.success(`Checked out ${name}`);
    useInsightsStore.getState().loadBranchHealth();
  } catch (e) {
    toast.error(
      `Checkout failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

async function handleDelete(name: string) {
  try {
    const result = await commands.deleteBranch(name, false);
    if (result.status === "error") {
      const errMsg =
        "message" in result.error
          ? String(result.error.message)
          : result.error.type;
      toast.error(`Delete failed: ${errMsg}`);
      return;
    }
    toast.success(`Deleted branch ${name}`);
    useInsightsStore.getState().loadBranchHealth();
  } catch (e) {
    toast.error(
      `Delete failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

export function BranchHealthOverview({ branches }: Props) {
  if (branches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-ctp-subtext0">
        <GitBranch className="mb-2 h-6 w-6 opacity-40" />
        <span className="text-xs">No branches found</span>
      </div>
    );
  }

  const visible = branches.slice(0, MAX_SHOWN);
  const remaining = branches.length - MAX_SHOWN;

  return (
    <div className="max-h-80 overflow-y-auto">
      <div className="flex flex-col gap-0.5">
        {visible.map((branch) => (
          <div
            key={branch.name}
            className="group flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-ctp-surface0/30 transition-colors"
          >
            {/* Branch icon with color coding */}
            <div
              className={`shrink-0 ${branch.isStale ? "text-ctp-yellow" : "text-ctp-green"}`}
            >
              <GitBranch className="h-3.5 w-3.5" />
            </div>

            {/* Branch name and metadata */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-xs font-medium text-ctp-text">
                  {branch.name}
                </span>
                {branch.isHead && (
                  <span className="shrink-0 rounded-full bg-ctp-green/15 px-1.5 py-0.5 text-[9px] font-medium text-ctp-green">
                    HEAD
                  </span>
                )}
                {branch.isStale && (
                  <AlertTriangle className="h-3 w-3 shrink-0 text-ctp-yellow" />
                )}
                {branch.isMerged && (
                  <CheckCircle2 className="h-3 w-3 shrink-0 text-ctp-green" />
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[10px] text-ctp-subtext0">
                <span>
                  {formatRelativeDate(branch.lastCommitTimestampMs)}
                </span>
                {(branch.ahead > 0 || branch.behind > 0) && (
                  <span className="flex items-center gap-1">
                    {branch.ahead > 0 && (
                      <span className="flex items-center text-ctp-green">
                        <ArrowUp className="h-2.5 w-2.5" />
                        {branch.ahead}
                      </span>
                    )}
                    {branch.behind > 0 && (
                      <span className="flex items-center text-ctp-red">
                        <ArrowDown className="h-2.5 w-2.5" />
                        {branch.behind}
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {!branch.isHead && !branch.isRemote && (
                <>
                  <button
                    onClick={() => handleCheckout(branch.name)}
                    className="rounded p-1 text-ctp-subtext0 hover:bg-ctp-surface1 hover:text-ctp-text"
                    title="Checkout branch"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => handleDelete(branch.name)}
                    className="rounded p-1 text-ctp-subtext0 hover:bg-ctp-red/10 hover:text-ctp-red"
                    title="Delete branch"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      {remaining > 0 && (
        <p className="mt-2 text-center text-[10px] text-ctp-subtext0">
          and {remaining} more branch{remaining !== 1 ? "es" : ""}...
        </p>
      )}
    </div>
  );
}
