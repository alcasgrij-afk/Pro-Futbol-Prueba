'use client';

import { motion, useReducedMotion } from 'framer-motion';

/**
 * Entrada suave en cascada al hacer scroll (stagger por `delay`).
 * once=true: no se repite. Con `prefers-reduced-motion` no hay movimiento.
 * Solo anima transform + opacity (nunca top/left/width/height).
 */
export default function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-48px' }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}