import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Bug,
  AlertTriangle,
  Package,
  FileText,
  RefreshCw,
  Workflow,
} from "lucide-react";
import type { CommitTemplate } from "../store";
import { BUILTIN_TEMPLATES } from "../lib/commit-templates";
import { cn } from "../../../lib/utils";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles,
  Bug,
  AlertTriangle,
  Package,
  FileText,
  RefreshCw,
  Workflow,
};

interface TemplateSelectorProps {
  onApply: (template: CommitTemplate) => void;
  isFormEmpty: boolean;
  activeTemplateId?: string | null;
}

export function TemplateSelector({
  onApply,
  isFormEmpty,
  activeTemplateId,
}: TemplateSelectorProps) {
  return (
    <AnimatePresence mode="wait">
      {isFormEmpty ? (
        <motion.div
          key="chips"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-2"
        >
          <label className="text-sm font-medium text-ctp-overlay1">
            Quick Start
          </label>
          <div className="flex flex-wrap gap-2">
            {BUILTIN_TEMPLATES.map((template) => {
              const Icon = template.icon ? ICON_MAP[template.icon] : null;
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => onApply(template)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors",
                    "border-ctp-surface1 text-ctp-subtext0 hover:border-ctp-blue hover:text-ctp-blue",
                    "focus:outline-none focus:ring-1 focus:ring-ctp-blue",
                  )}
                  title={template.description}
                >
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                  {template.label}
                </button>
              );
            })}
          </div>
        </motion.div>
      ) : activeTemplateId ? (
        <motion.div
          key="badge"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex items-center gap-1.5 text-xs text-ctp-overlay1"
        >
          <span className="px-2 py-0.5 rounded-full bg-ctp-surface1 text-ctp-subtext0">
            Template:{" "}
            {BUILTIN_TEMPLATES.find((t) => t.id === activeTemplateId)?.label}
          </span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
