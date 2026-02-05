import { AnimatePresence } from "framer-motion";
import { useEffect, useRef } from "react";
import { useToastStore } from "../../stores/toast";
import { Toast } from "./Toast";

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();
  const timeoutRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const visibleToasts = toasts.slice(-3);

  useEffect(() => {
    for (const toast of visibleToasts) {
      if (!toast.duration || timeoutRefs.current.has(toast.id)) {
        continue;
      }

      const timeoutId = setTimeout(() => {
        removeToast(toast.id);
        timeoutRefs.current.delete(toast.id);
      }, toast.duration);

      timeoutRefs.current.set(toast.id, timeoutId);
    }

    return () => {
      const visibleIds = new Set(visibleToasts.map((t) => t.id));
      for (const [id, timeoutId] of timeoutRefs.current.entries()) {
        if (!visibleIds.has(id)) {
          clearTimeout(timeoutId);
          timeoutRefs.current.delete(id);
        }
      }
    };
  }, [visibleToasts, removeToast]);

  useEffect(() => {
    return () => {
      for (const timeoutId of timeoutRefs.current.values()) {
        clearTimeout(timeoutId);
      }
      timeoutRefs.current.clear();
    };
  }, []);

  const handleDismiss = (id: string) => {
    const timeoutId = timeoutRefs.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutRefs.current.delete(id);
    }
    removeToast(id);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2">
      <AnimatePresence mode="popLayout">
        {visibleToasts.map((toast) => (
          <Toast
            key={toast.id}
            toast={toast}
            onDismiss={() => handleDismiss(toast.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
