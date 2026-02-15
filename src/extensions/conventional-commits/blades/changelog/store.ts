import { commands } from "../../../../bindings";
import type {
  ChangelogCommit,
  ChangelogOutput,
  CommitGroup,
} from "../../../../bindings";
import { createBladeStore } from "@/framework/stores/createBladeStore";

interface ChangelogState {
  // Options
  fromRef: string;
  toRef: string;
  version: string;

  // Output
  changelog: ChangelogOutput | null;
  isGenerating: boolean;
  error: string | null;

  // Actions
  setFromRef: (ref: string) => void;
  setToRef: (ref: string) => void;
  setVersion: (version: string) => void;

  generate: () => Promise<void>;
  reset: () => void;
}

export const useChangelogStore = createBladeStore<ChangelogState>(
  "changelog",
  (set, get) => ({
    // Initial state
    fromRef: "",
    toRef: "HEAD",
    version: "",
    changelog: null,
    isGenerating: false,
    error: null,

    // Setters
    setFromRef: (ref) => set({ fromRef: ref }),
    setToRef: (ref) => set({ toRef: ref }),
    setVersion: (version) => set({ version }),

    generate: async () => {
      const { fromRef, toRef, version } = get();
      set({ isGenerating: true, error: null });

      try {
        const result = await commands.generateChangelogCmd(
          fromRef || null,
          toRef || null,
          version || null,
        );

        if (result.status === "ok") {
          set({ changelog: result.data, isGenerating: false });
        } else {
          const errorMessage =
            "message" in result.error
              ? String(result.error.message)
              : result.error.type;
          set({ error: errorMessage, isGenerating: false });
        }
      } catch (e) {
        set({ error: String(e), isGenerating: false });
      }
    },

    reset: () =>
      set({
        fromRef: "",
        toRef: "HEAD",
        version: "",
        changelog: null,
        error: null,
      }),
  }),
);

export type { ChangelogOutput, CommitGroup, ChangelogCommit };
