"use client";

import { motion, useSpring, useMotionValueEvent, type HTMLMotionProps } from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";

/* ---------- Animated number: springs between values ---------- */
export function AnimatedNumber({
  value,
  decimals = 1,
  signed = false,
  className,
}: {
  value: number;
  decimals?: number;
  signed?: boolean;
  className?: string;
}) {
  const spring = useSpring(value, { stiffness: 140, damping: 22, mass: 0.8 });
  const ref = useRef<HTMLSpanElement>(null);
  const fmt = (v: number) => {
    const s = Math.abs(v).toFixed(decimals);
    if (!signed) return (v < 0 ? "-" : "") + s;
    return (v > 0.00001 ? "+" : v < -0.00001 ? "-" : "±") + s;
  };

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  useMotionValueEvent(spring, "change", (v) => {
    if (ref.current) ref.current.textContent = fmt(v);
  });

  return (
    <span ref={ref} className={className}>
      {fmt(value)}
    </span>
  );
}

/* ---------- Brutalist button with heavy press feedback ---------- */
type Tone = "paper" | "ink" | "acid" | "blaze";
const toneCls: Record<Tone, string> = {
  paper: "bg-paper text-ink",
  ink: "bg-ink text-paper",
  acid: "bg-acid text-ink",
  blaze: "bg-blaze text-ink",
};

export function BrutalButton({
  tone = "paper",
  className = "",
  children,
  shadow = true,
  ...rest
}: { tone?: Tone; shadow?: boolean; children: ReactNode } & HTMLMotionProps<"button">) {
  return (
    <motion.button
      type="button"
      {...rest}
      initial={false}
      whileHover={shadow ? { x: -2, y: -2, boxShadow: "4px 4px 0 0 #000" } : { backgroundColor: "#CCFF00" }}
      whileTap={shadow ? { x: 2, y: 2, boxShadow: "0px 0px 0 0 #000", scale: 0.97 } : { scale: 0.92 }}
      transition={{ type: "spring", stiffness: 700, damping: 28, mass: 1.2 }}
      style={{ boxShadow: shadow ? "2px 2px 0 0 #000" : undefined }}
      className={`inline-flex select-none items-center justify-center gap-1.5 border-2 border-ink font-mono text-xs font-bold uppercase tracking-wider disabled:pointer-events-none disabled:opacity-40 ${toneCls[tone]} ${className}`}
    >
      {children}
    </motion.button>
  );
}

/* ---------- Bento cell with index label + hover reaction ---------- */
export function Cell({
  index,
  label,
  className = "",
  children,
  right,
}: {
  index?: string;
  label?: string;
  className?: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <motion.section
      initial="rest"
      animate="rest"
      whileHover="hover"
      className={`group relative flex flex-col ${className}`}
    >
      {(index || label || right) && (
        <header className="flex items-center justify-between gap-3 px-4 pt-3 font-mono text-[11px] uppercase tracking-[0.14em]">
          <div className="flex items-center gap-2">
            {index && (
              <motion.span
                variants={{ rest: { backgroundColor: "#F4F4F0" }, hover: { backgroundColor: "#CCFF00" } }}
                transition={{ duration: 0.15 }}
                className="border-[1.5px] border-ink px-1.5 py-px font-bold"
              >
                {index}
              </motion.span>
            )}
            {label && <span>{label}</span>}
          </div>
          {right}
        </header>
      )}
      <motion.span
        aria-hidden
        variants={{ rest: { scale: 0, rotate: 0 }, hover: { scale: 1, rotate: 90 } }}
        transition={{ type: "spring", stiffness: 500, damping: 26 }}
        className="pointer-events-none absolute right-0 bottom-0 h-3 w-3 origin-bottom-right bg-ink"
      />
      {children}
    </motion.section>
  );
}

export function Tag({ tone, children }: { tone: "acid" | "blaze" | "ink" | "paper"; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 border-2 border-ink px-2 py-1 font-mono text-xs font-bold uppercase tracking-wider ${toneCls[tone]}`}
    >
      {children}
    </span>
  );
}
