import { AnimatePresence, motion } from "framer-motion";
import { useBladeStore } from "../../stores/blades";
import { BladeRenderer } from "./BladeRenderer";
import { BladeStrip } from "./BladeStrip";

export function BladeContainer() {
  const { bladeStack, popToIndex, popBlade } = useBladeStore();
  const activeBlade = bladeStack[bladeStack.length - 1];

  return (
    <div className="flex h-full overflow-hidden">
      {bladeStack.slice(0, -1).map((blade, index) => (
        <BladeStrip
          key={blade.id}
          title={blade.title}
          onExpand={() => popToIndex(index)}
        />
      ))}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={activeBlade.id}
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ type: "tween", ease: "easeOut", duration: 0.2 }}
          className="flex-1 min-w-0"
        >
          <BladeRenderer blade={activeBlade} goBack={popBlade} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
