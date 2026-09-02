import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Channel } from "@tauri-apps/api/core";
import { ArrowDown, ArrowUp, CloudDownload, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/core/components/ui/button";
import { ShortcutTooltip } from "@/core/components/ui/ShortcutTooltip";
import { gitHookBus } from "@/core/services/gitHookBus";
import { toast } from "@/framework/stores/toast";
import { commands, type SyncProgress } from "../../../bindings";
import { describeSyncResult, formatSyncException } from "../lib/syncMessages";
import { SyncProgressDisplay } from "./SyncProgress";

export function SyncButtons() {
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const queryClient = useQueryClient();

  const { data: result } = useQuery({
    queryKey: ["remotes"],
    queryFn: () => commands.getRemotes(),
  });

  const remotes = result?.status === "ok" ? result.data : [];
  const hasRemote = remotes.length > 0;
  const defaultRemote = remotes[0]?.name || "origin";

  const createProgressChannel = useCallback(() => {
    const channel = new Channel<SyncProgress>();
    channel.onmessage = (event) => {
      setProgress(event);
      if (event.event === "finished" || event.event === "error") {
        setTimeout(() => setProgress(null), 3000);
      }
    };
    return channel;
  }, []);

  const pushMutation = useMutation({
    mutationFn: async () => {
      const channel = createProgressChannel();
      return commands.pushToRemote(defaultRemote, channel);
    },
    onSuccess: (result) => {
      const outcome = describeSyncResult("push", result, defaultRemote);
      if (!outcome.ok) {
        toast.error(outcome.message);
        return;
      }
      toast.success(outcome.message);
      queryClient.invalidateQueries({ queryKey: ["commitHistory"] });
      gitHookBus.emitDid("push");
    },
    onError: (error) => {
      toast.error(formatSyncException("push", error), {
        label: "Retry",
        onClick: () => pushMutation.mutate(),
      });
    },
  });

  const pullMutation = useMutation({
    mutationFn: async () => {
      const channel = createProgressChannel();
      return commands.pullFromRemote(defaultRemote, channel);
    },
    onSuccess: (result) => {
      const outcome = describeSyncResult("pull", result, defaultRemote);
      if (!outcome.ok) {
        toast.error(outcome.message);
        return;
      }
      toast.success(outcome.message);
      queryClient.invalidateQueries({ queryKey: ["stagingStatus"] });
      queryClient.invalidateQueries({ queryKey: ["commitHistory"] });
      queryClient.invalidateQueries({ queryKey: ["repositoryStatus"] });
      gitHookBus.emitDid("pull");
    },
    onError: (error) => {
      toast.error(formatSyncException("pull", error), {
        label: "Retry",
        onClick: () => pullMutation.mutate(),
      });
    },
  });

  const fetchMutation = useMutation({
    mutationFn: async () => {
      const channel = createProgressChannel();
      return commands.fetchFromRemote(defaultRemote, channel);
    },
    onSuccess: (result) => {
      const outcome = describeSyncResult("fetch", result, defaultRemote);
      if (!outcome.ok) {
        toast.error(outcome.message);
        return;
      }
      toast.success(outcome.message);
      gitHookBus.emitDid("fetch");
    },
    onError: (error) => {
      toast.error(formatSyncException("fetch", error), {
        label: "Retry",
        onClick: () => fetchMutation.mutate(),
      });
    },
  });

  const isLoading =
    pushMutation.isPending || pullMutation.isPending || fetchMutation.isPending;

  if (!hasRemote) {
    return null;
  }

  return (
    <div className="flex items-center gap-1">
      {progress && <SyncProgressDisplay progress={progress} />}

      <ShortcutTooltip shortcut="mod+shift+F" label="Fetch">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchMutation.mutate()}
          disabled={isLoading}
        >
          {fetchMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CloudDownload className="w-4 h-4" />
          )}
        </Button>
      </ShortcutTooltip>

      <ShortcutTooltip shortcut="mod+shift+L" label="Pull">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => pullMutation.mutate()}
          disabled={isLoading}
        >
          {pullMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ArrowDown className="w-4 h-4" />
          )}
        </Button>
      </ShortcutTooltip>

      <ShortcutTooltip shortcut="mod+shift+U" label="Push">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => pushMutation.mutate()}
          disabled={isLoading}
        >
          {pushMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ArrowUp className="w-4 h-4" />
          )}
        </Button>
      </ShortcutTooltip>
    </div>
  );
}
