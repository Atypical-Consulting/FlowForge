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
  const [nudgeX, setNudgeX] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
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
    setNudgeX(0);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (visible && tooltipRef.current) {
      const rect = tooltipRef.current.getBoundingClientRect();
      const padding = 8;
      let shift = 0;
      if (rect.right > window.innerWidth - padding) {
        shift = window.innerWidth - padding - rect.right;
      } else if (rect.left < padding) {
        shift = padding - rect.left;
      }
      if (shift !== 0) setNudgeX(shift);
    }
  }, [visible]);

  const formatted = formatShortcut(shortcut);
  const keys = parseKeys(formatted);

  const positionClasses =
    side === "bottom" ? "top-full mt-1.5" : "bottom-full mb-1.5";

  const tooltipStyle = {
    transform: `translateX(calc(-50% + ${nudgeX}px))`,
  };

  const kbdElements = keys.map((key, i) => (
    <kbd
      key={`${key}-${i}`}
      className="inline-flex items-center justify-center min-w-4.5 h-4.5 px-1 text-[10px] font-mono font-medium rounded bg-ctp-surface0/80 text-ctp-subtext0"
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
              ref={tooltipRef}
              key="tooltip"
              style={tooltipStyle}
              className={`absolute left-1/2 z-50 rounded-md bg-ctp-mantle/95 backdrop-blur-sm px-2.5 py-1.5 shadow-md border border-ctp-surface0/30 pointer-events-none whitespace-nowrap ${positionClasses}`}
            >
              {tooltipInner}
            </div>
          ) : (
            <motion.div
              ref={tooltipRef}
              key="tooltip"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={tooltipStyle}
              className={`absolute left-1/2 z-50 rounded-md bg-ctp-mantle/95 backdrop-blur-sm px-2.5 py-1.5 shadow-md border border-ctp-surface0/30 pointer-events-none whitespace-nowrap ${positionClasses}`}
            >
              {tooltipInner}
            </motion.div>
          ))}
      </AnimatePresence>
    </div>
  );
}
