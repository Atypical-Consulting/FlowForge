import { create } from "zustand";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  action?: ToastAction;
  duration?: number;
  createdAt: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id" | "createdAt">) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

const DEFAULT_DURATIONS: Record<ToastType, number | undefined> = {
  success: 5000,
  info: 5000,
  error: undefined,
  warning: undefined,
};

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (toastData) => {
    const id = crypto.randomUUID();
    const duration = toastData.duration ?? DEFAULT_DURATIONS[toastData.type];
    const toast: Toast = {
      ...toastData,
      id,
      duration,
      createdAt: Date.now(),
    };

    set((state) => ({
      toasts: [...state.toasts, toast],
    }));

    return id;
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearAll: () => {
    set({ toasts: [] });
  },
}));

export const toast = {
  success: (message: string, action?: ToastAction): string => {
    return useToastStore.getState().addToast({ type: "success", message, action });
  },
  error: (message: string, action?: ToastAction): string => {
    return useToastStore.getState().addToast({ type: "error", message, action });
  },
  info: (message: string, action?: ToastAction): string => {
    return useToastStore.getState().addToast({ type: "info", message, action });
  },
  warning: (message: string, action?: ToastAction): string => {
    return useToastStore.getState().addToast({ type: "warning", message, action });
  },
};
