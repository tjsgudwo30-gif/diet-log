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
    return (v > 0.00001 ? "+" : v < -0.00001 ? "−" : "±") + s;
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

/* ---------- Button: flat, hairline, firm press ---------- */
type Tone = "paper" | "ink" | "acid" | "blaze";
const toneCls: Record<Tone, string> = {
  paper: "bg-paper text-ink border-ink hover:bg-ink hover:text-paper",
  ink: "bg-ink text-paper border-ink hover:bg-ink/85",
  acid: "bg-acid text-ink border-ink hover:bg-ink hover:text-paper",
  blaze: "bg-blaze text-ink border-ink hover:bg-ink hover:text-paper",
};

/**
 * Kept as `BrutalButton` for API compatibility, now a calm flat button:
 * 1.5px border, no drop shadow, colour inversion on hover and a short, weighty press.
 * (`shadow` is accepted and ignored.)
 */
export function BrutalButton({
  tone = "paper",
  className = "",
  children,
  shadow: _shadow,
  ...rest
}: { tone?: Tone; shadow?: boolean; children: ReactNode } & HTMLMotionProps<"button">) {
  void _shadow;
  return (
    <motion.button
      type="button"
      {...rest}
      whileTap={{ scale: 0.96, y: 1 }}
      transition={{ type: "spring", stiffness: 700, damping: 30, mass: 1.1 }}
      className={`inline-flex select-none items-center justify-center gap-1.5 border-[1.5px] font-mono text-[11px] font-bold uppercase tracking-[0.08em] transition-colors disabled:pointer-events-none disabled:opacity-35 ${toneCls[tone]} ${className}`}
    >
      {children}
    </motion.button>
  );
}

/* ---------- Chip: the one tag/preset style used everywhere ---------- */
export function Chip({
  active = false,
  danger = false,
  className = "",
  children,
  ...rest
}: { active?: boolean; danger?: boolean; children: ReactNode } & HTMLMotionProps<"button">) {
  const state = danger
    ? "border-blaze text-blaze hover:bg-blaze hover:text-ink"
    : active
      ? "border-ink bg-ink text-paper"
      : "border-ink/25 text-ink hover:border-ink";
  return (
    <motion.button
      type="button"
      {...rest}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 700, damping: 30 }}
      className={`inline-flex h-9 shrink-0 select-none items-center gap-1 border px-2.5 font-mono text-[11px] transition-colors md:h-7 md:px-2 ${state} ${className}`}
    >
      {children}
    </motion.button>
  );
}

/* ---------- Small caps label ---------- */
export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink/55 ${className}`}>{children}</span>
  );
}

/* ---------- Bento cell: quiet index + label header ---------- */
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
    <section className={`relative flex flex-col ${className}`}>
      {(index || label || right) && (
        <header className="flex min-h-6 items-center justify-between gap-3 px-5 pt-4 md:px-6 md:pt-5">
          <Label className="flex items-center gap-2">
            {index && <span className="text-ink">{index}</span>}
            {index && label && <span aria-hidden className="h-px w-4 bg-ink/30" />}
            {label && <span>{label}</span>}
          </Label>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

/** Tiny square status mark (acid = good / today, blaze = up / injection / warning). */
export function Dot({ tone, className = "" }: { tone: "acid" | "blaze" | "ink"; className?: string }) {
  const bg = tone === "acid" ? "bg-acid" : tone === "blaze" ? "bg-blaze" : "bg-ink";
  return <span aria-hidden className={`inline-block h-2 w-2 shrink-0 border border-ink ${bg} ${className}`} />;
}
