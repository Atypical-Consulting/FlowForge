import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { formatShortcut } from "../../hooks/useKeyboardShortcuts";

interface ShortcutTooltipProps {
  shortcut: string;
  label: string;
  children: ReactNode;
  side?: "top" | "bottom";
}

function parseKeys(formatted: string): string[] {
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  if (isMac) {
    return formatted.split("");
  }
  return formatted.split("+");
}

export function ShortcutTooltip({
  shortcut,
  label,
  children,
  side = "bottom",
}: ShortcutTooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const handleMouseEnter = () => {
    timerRef.current = setTimeout(() => {
      setVisible(true);
    }, 500);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const formatted = formatShortcut(shortcut);
  const keys = parseKeys(formatted);

  const positionClasses =
    side === "bottom" ? "top-full mt-1.5" : "bottom-full mb-1.5";

  const kbdElements = keys.map((key, i) => (
    <kbd
      key={`${key}-${i}`}
      className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-mono font-medium rounded border border-ctp-surface2 bg-ctp-surface0 text-ctp-subtext1 shadow-[0_1px_0_0_var(--ctp-surface2)]"
    >
      {key}
    </kbd>
  ));

  const tooltipInner = (
    <>
      <span className="text-xs text-ctp-subtext0 mr-2">{label}</span>
      <span className="inline-flex items-center gap-0.5">{kbdElements}</span>
    </>
  );

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      <AnimatePresence>
        {visible &&
          (shouldReduceMotion ? (
            <div
              key="tooltip"
              className={`absolute left-1/2 z-50 -translate-x-1/2 rounded-md border border-ctp-surface0 bg-ctp-crust px-2.5 py-1.5 shadow-lg pointer-events-none whitespace-nowrap ${positionClasses}`}
            >
              {tooltipInner}
            </div>
          ) : (
            <motion.div
              key="tooltip"
              initial={{ opacity: 0, y: side === "bottom" ? 2 : -2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: side === "bottom" ? 2 : -2 }}
              transition={{ duration: 0.15 }}
              className={`absolute left-1/2 z-50 -translate-x-1/2 rounded-md border border-ctp-surface0 bg-ctp-crust px-2.5 py-1.5 shadow-lg pointer-events-none whitespace-nowrap ${positionClasses}`}
            >
              {tooltipInner}
            </motion.div>
          ))}
      </AnimatePresence>
    </div>
  );
}
