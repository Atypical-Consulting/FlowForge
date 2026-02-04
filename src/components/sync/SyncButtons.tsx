import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Channel } from "@tauri-apps/api/core";
import { ArrowDown, ArrowUp, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";
import { type SyncProgress, commands } from "../../bindings";
import { Button } from "../ui/button";
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commitHistory"] });
    },
  });

  const pullMutation = useMutation({
    mutationFn: async () => {
      const channel = createProgressChannel();
      return commands.pullFromRemote(defaultRemote, channel);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stagingStatus"] });
      queryClient.invalidateQueries({ queryKey: ["commitHistory"] });
      queryClient.invalidateQueries({ queryKey: ["repositoryStatus"] });
    },
  });

  const fetchMutation = useMutation({
    mutationFn: async () => {
      const channel = createProgressChannel();
      return commands.fetchFromRemote(defaultRemote, channel);
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

      <Button
        variant="ghost"
        size="sm"
        onClick={() => fetchMutation.mutate()}
        disabled={isLoading}
        title="Fetch"
      >
        {fetchMutation.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <RefreshCw className="w-4 h-4" />
        )}
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => pullMutation.mutate()}
        disabled={isLoading}
        title="Pull"
      >
        {pullMutation.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <ArrowDown className="w-4 h-4" />
        )}
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => pushMutation.mutate()}
        disabled={isLoading}
        title="Push"
      >
        {pushMutation.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <ArrowUp className="w-4 h-4" />
        )}
      </Button>
    </div>
  );
}
