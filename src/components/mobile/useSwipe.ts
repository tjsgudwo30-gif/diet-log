"use client";

import { useRef } from "react";

/** Finger travel (px) that commits a swipe; a quick flick needs less. */
const COMMIT_PX = 64;
const FLICK_PX = 28;
const FLICK_SPEED = 0.45; // px/ms
/** Movement before the gesture picks an axis; horizontal must clearly dominate. */
const LOCK_PX = 10;
const H_DOMINANCE = 1.3;
/** Starts this close to the screen edge are left to the OS (iOS back swipe). */
const EDGE_PX = 24;

/**
 * Horizontal swipe on a vertically scrolling area. Put `touch-pan-y` on the element so the
 * browser keeps vertical scrolling and leaves horizontal travel to us. The axis is decided
 * once per gesture, so a slightly diagonal scroll never flips the day.
 *
 * `onSwipe(1)` = finger moved left (next), `onSwipe(-1)` = moved right (previous).
 * `onDrag(dx)` follows the finger while the gesture is horizontal; `onEnd(committed)` fires
 * when it ends.
 */
export function useSwipe(
  onSwipe: (dir: 1 | -1) => void,
  { onDrag, onEnd }: { onDrag?: (dx: number) => void; onEnd?: (committed: boolean) => void } = {}
) {
  const g = useRef<{ x: number; y: number; t: number; axis: "x" | "y" | null; dx: number } | null>(null);

  const ignore = (target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    return !!el?.closest("input, textarea, select, [contenteditable], [data-no-swipe], .no-scrollbar");
  };

  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (e.touches.length !== 1 || t.clientX < EDGE_PX || t.clientX > window.innerWidth - EDGE_PX || ignore(e.target)) {
        g.current = null;
        return;
      }
      g.current = { x: t.clientX, y: t.clientY, t: e.timeStamp, axis: null, dx: 0 };
    },
    onTouchMove: (e: React.TouchEvent) => {
      const s = g.current;
      if (!s) return;
      const t = e.touches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (!s.axis) {
        if (Math.abs(dx) < LOCK_PX && Math.abs(dy) < LOCK_PX) return;
        s.axis = Math.abs(dx) > Math.abs(dy) * H_DOMINANCE ? "x" : "y";
      }
      if (s.axis !== "x") return;
      s.dx = dx;
      onDrag?.(dx);
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = g.current;
      g.current = null;
      if (!s || s.axis !== "x") return;
      const speed = Math.abs(s.dx) / Math.max(1, e.timeStamp - s.t);
      const commit = Math.abs(s.dx) >= COMMIT_PX || (Math.abs(s.dx) >= FLICK_PX && speed >= FLICK_SPEED);
      onEnd?.(commit);
      if (commit) onSwipe(s.dx < 0 ? 1 : -1);
    },
    onTouchCancel: () => {
      if (g.current?.axis === "x") onEnd?.(false);
      g.current = null;
    },
  };
}
