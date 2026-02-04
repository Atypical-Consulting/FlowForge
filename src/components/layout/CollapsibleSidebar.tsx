import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type ReactNode, useState, useEffect } from "react";
import { cn } from "../../lib/utils";

interface CollapsibleSidebarProps {
  children: ReactNode;
  defaultCollapsed?: boolean;
  storageKey?: string;
}

export function CollapsibleSidebar({
  children,
  defaultCollapsed = false,
  storageKey = "sidebar-collapsed",
}: CollapsibleSidebarProps) {
  const [collapsed, setCollapsed] = useState(() => {
    const stored = localStorage.getItem(storageKey);
    return stored ? JSON.parse(stored) : defaultCollapsed;
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(collapsed));
  }, [collapsed, storageKey]);

  return (
    <div className="relative h-full flex">
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "auto", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="h-full overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className={cn(
          "absolute top-2 -right-3 z-10",
          "w-6 h-6 rounded-full",
          "bg-ctp-surface0 border border-ctp-surface1",
          "flex items-center justify-center",
          "text-ctp-subtext0 hover:text-ctp-text",
          "hover:bg-ctp-surface1 transition-colors",
          "shadow-md"
        )}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}
