import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { staggerContainer, staggerItem } from "../../lib/animations";

interface AnimatedListProps {
  children: ReactNode;
  className?: string;
  /** Limit stagger to first N items for performance */
  staggerLimit?: number;
}

export function AnimatedList({
  children,
  className,
}: AnimatedListProps) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface AnimatedListItemProps {
  children: ReactNode;
  className?: string;
  /** Index of item - items beyond staggerLimit won't animate */
  index?: number;
  staggerLimit?: number;
}

export function AnimatedListItem({
  children,
  className,
  index = 0,
  staggerLimit = 15,
}: AnimatedListItemProps) {
  // Skip animation for items beyond the limit (performance)
  if (index >= staggerLimit) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div variants={staggerItem} className={className}>
      {children}
    </motion.div>
  );
}
