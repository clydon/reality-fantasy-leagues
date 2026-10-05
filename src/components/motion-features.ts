// Split into its own module so `LazyMotion`'s dynamic import actually code-splits domMax out of
// the initial bundle -- importing it directly in motion.tsx would bundle it anyway.
export { domMax as default } from "motion/react";
