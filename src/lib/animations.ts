import type { Variants, Transition } from "framer-motion";

// Standard transitions
export const springTransition: Transition = {
  type: "spring",
  stiffness: 500,
  damping: 30,
};

export const easeTransition: Transition = {
  type: "tween",
  ease: "easeOut",
  duration: 0.2,
};

// Stagger container - orchestrates child animations
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

// Stagger item - used by children of stagger container
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: easeTransition,
  },
};

// Fade in from bottom
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" },
  },
};

// Fade in scale
export const fadeInScale: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.2, ease: "easeOut" },
  },
};

// Simple fade
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { duration: 0.2 },
  },
};

// Slide in from left (for sidebar items)
export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -10 },
  show: {
    opacity: 1,
    x: 0,
    transition: easeTransition,
  },
};

// Tab content transition
export const tabContent: Variants = {
  hidden: { opacity: 0, x: 10 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.15, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    x: -10,
    transition: { duration: 0.1, ease: "easeIn" },
  },
};

// Blade slide in from right
export const bladeSlideIn: Variants = {
  hidden: { x: 40, opacity: 0 },
  show: {
    x: 0,
    opacity: 1,
    transition: { type: "tween", ease: "easeOut", duration: 0.2 },
  },
  exit: {
    x: 40,
    opacity: 0,
    transition: { type: "tween", ease: "easeIn", duration: 0.15 },
  },
};
