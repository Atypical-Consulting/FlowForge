import { motion } from "framer-motion";
import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../../lib/utils";
import type { Toast as ToastType } from "../../stores/toast";

interface ToastProps {
  toast: ToastType;
  onDismiss: () => void;
}

const typeStyles = {
  success: "bg-ctp-green/10 border-ctp-green/30 text-ctp-green",
  error: "bg-ctp-red/10 border-ctp-red/30 text-ctp-red",
  info: "bg-ctp-blue/10 border-ctp-blue/30 text-ctp-blue",
  warning: "bg-ctp-yellow/10 border-ctp-yellow/30 text-ctp-yellow",
};

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

export function Toast({ toast, onDismiss }: ToastProps) {
  const [progress, setProgress] = useState(100);
  const Icon = icons[toast.type];
  const hasDuration = toast.duration !== undefined && toast.duration > 0;

  useEffect(() => {
    if (!hasDuration) return;

    const startTime = Date.now();
    const duration = toast.duration!;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 16);

    return () => clearInterval(interval);
  }, [hasDuration, toast.duration]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn(
        "relative flex items-center gap-3 px-4 py-3 rounded-lg border",
        "shadow-lg backdrop-blur-sm min-w-75 max-w-100",
        "overflow-hidden",
        typeStyles[toast.type],
      )}
    >
      {hasDuration && (
        <motion.div
          className="absolute bottom-0 left-0 h-1 bg-current opacity-30"
          initial={{ width: "100%" }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.016, ease: "linear" }}
        />
      )}

      <Icon className="w-5 h-5 shrink-0" />
      <span className="text-sm font-medium flex-1">{toast.message}</span>

      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.onClick();
            onDismiss();
          }}
          className="px-2 py-1 text-xs font-medium rounded hover:bg-ctp-surface0/50 transition-colors"
        >
          {toast.action.label}
        </button>
      )}

      <button
        type="button"
        onClick={onDismiss}
        className="p-1 hover:bg-ctp-surface0/50 rounded transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}
