import { create } from "zustand";

/**
 * In-app replacement for the browser's native confirm() prompt.
 *
 * The native prompt is a no-op in the Tauri/WebKitGTK webview: it returns
 * immediately (truthy) without showing anything, so destructive actions
 * guarded by it ran unconfirmed. This store holds at most one pending
 * confirmation; `<ConfirmDialogHost />` (mounted once in App) renders it and
 * settles the promise returned by `confirm()`.
 */
export interface ConfirmOptions {
  /** Short heading, e.g. "Drop stash". */
  title: string;
  /** Body text. Newlines are preserved when rendered. */
  description?: string;
  /** Label of the primary button. Defaults to "Confirm". */
  confirmLabel?: string;
  /** Label of the secondary button. Defaults to "Cancel". */
  cancelLabel?: string;
  /** Render the primary button in the destructive style. */
  danger?: boolean;
}

export interface PendingConfirm extends ConfirmOptions {
  id: string;
  resolve: (confirmed: boolean) => void;
}

interface ConfirmState {
  pending: PendingConfirm | null;
  request: (options: ConfirmOptions) => Promise<boolean>;
  settle: (confirmed: boolean) => void;
}

let nextId = 0;

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  pending: null,

  request: (options) =>
    new Promise<boolean>((resolve) => {
      // A newer request supersedes a dialog still waiting for an answer; the
      // superseded one is treated as cancelled so its caller never hangs.
      get().pending?.resolve(false);
      nextId += 1;
      set({ pending: { ...options, id: `confirm-${nextId}`, resolve } });
    }),

  settle: (confirmed) => {
    const { pending } = get();
    if (!pending) return;
    set({ pending: null });
    pending.resolve(confirmed);
  },
}));

/**
 * Ask the user to confirm an action. Resolves `true` when the primary button
 * is activated (click or Enter), `false` on cancel, Escape, or backdrop click.
 *
 * Usable from plain TypeScript (commands, stores) as well as components.
 */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().request(options);
}
