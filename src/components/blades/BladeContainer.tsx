import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import type { Blade } from "../../stores/blades";
import { useBladeStore } from "../../stores/blades";
import { BladeStrip } from "./BladeStrip";

interface BladeContainerProps {
  renderBlade: (blade: Blade) => ReactNode;
}

export function BladeContainer({ renderBlade }: BladeContainerProps) {
  const { bladeStack, popToIndex } = useBladeStore();

  return (
    <div className="flex h-full overflow-hidden">
      {bladeStack.map((blade, index) => {
        const isActive = index === bladeStack.length - 1;

        if (!isActive) {
          return (
            <BladeStrip
              key={blade.id}
              title={blade.title}
              onExpand={() => popToIndex(index)}
            />
          );
        }

        return (
          <AnimatePresence mode="popLayout" key="active-blade">
            <motion.div
              key={blade.id}
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="flex-1 min-w-0"
            >
              {renderBlade(blade)}
            </motion.div>
          </AnimatePresence>
        );
      })}
    </div>
  );
}
