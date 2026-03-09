import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import type { CommitType } from "../../../bindings";
import { commands } from "../../../bindings";
import { parseConventionalMessage } from "../lib/conventional-utils";

interface UseAmendPrefillOptions {
  mode: "simple" | "conventional";
}

/**
 * Reusable hook for amend mode with last commit pre-fill.
 *
 * Extracted from CommitForm.tsx to be shared between sidebar and blade.
 */
export function useAmendPrefill({ mode: _mode }: UseAmendPrefillOptions) {
  const [amend, setAmend] = useState(false);

  const { data: lastMessageResult, refetch: refetchLastMessage } = useQuery({
    queryKey: ["lastCommitMessage"],
    queryFn: () => commands.getLastCommitMessage(),
    enabled: false,
  });

  const lastMessage =
    lastMessageResult?.status === "ok" ? lastMessageResult.data : null;

  const originalMessage = lastMessage?.fullMessage ?? null;

  const toggleAmend = useCallback(
    async (
      checked: boolean,
      callbacks: {
        onPrefill?: (fullMessage: string) => void;
        onClear?: () => void;
        hasContent?: boolean;
      },
    ) => {
      if (checked) {
        const result = await refetchLastMessage();
        const fetchedMessage =
          result.data?.status === "ok" ? result.data.data : null;

        if (fetchedMessage) {
          if (!callbacks.hasContent) {
            callbacks.onPrefill?.(fetchedMessage.fullMessage);
            setAmend(true);
          } else {
            const shouldReplace = window.confirm(
              "You have unsaved text. Replace with previous commit message?",
            );
            if (shouldReplace) {
              callbacks.onPrefill?.(fetchedMessage.fullMessage);
            }
            setAmend(true);
          }
        } else {
          setAmend(true);
        }
      } else {
        setAmend(false);
        callbacks.onClear?.();
      }
    },
    [refetchLastMessage],
  );

  /**
   * Pre-fill conventional commit form fields from the last commit.
   * Parses the last commit message into CC parts if possible.
   */
  const prefillConventional = useCallback(
    async (store: {
      setCommitType: (type: CommitType | "") => void;
      setScope: (scope: string) => void;
      setDescription: (desc: string) => void;
      setBody: (body: string) => void;
      setIsBreaking: (breaking: boolean) => void;
      setBreakingDescription: (desc: string) => void;
    }) => {
      const result = await refetchLastMessage();
      const fetchedMessage =
        result.data?.status === "ok" ? result.data.data : null;

      if (fetchedMessage) {
        const parsed = parseConventionalMessage(fetchedMessage.fullMessage);
        if (parsed) {
          store.setCommitType(parsed.commitType as CommitType);
          store.setScope(parsed.scope);
          store.setDescription(parsed.description);
          store.setBody(parsed.body);
          store.setIsBreaking(parsed.isBreaking);
          store.setBreakingDescription(parsed.breakingDescription);
        } else {
          // Non-CC commit: put entire subject as description
          const subject = fetchedMessage.fullMessage.split("\n")[0] || "";
          store.setCommitType("");
          store.setScope("");
          store.setDescription(subject);
          store.setBody("");
          store.setIsBreaking(false);
          store.setBreakingDescription("");
        }
      }
    },
    [refetchLastMessage],
  );

  return {
    amend,
    setAmend,
    toggleAmend,
    prefillConventional,
    lastMessage,
    originalMessage,
    refetchLastMessage,
  };
}
