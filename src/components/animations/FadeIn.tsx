import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { fadeIn, fadeInUp, fadeInScale } from "../../lib/animations";

interface FadeInProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "up" | "scale";
  delay?: number;
}

export function FadeIn({
  children,
  className,
  variant = "default",
  delay = 0,
}: FadeInProps) {
  const variants = {
    default: fadeIn,
    up: fadeInUp,
    scale: fadeInScale,
  };

  return (
    <motion.div
      variants={variants[variant]}
      initial="hidden"
      animate="show"
      className={className}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </motion.div>
  );
}
