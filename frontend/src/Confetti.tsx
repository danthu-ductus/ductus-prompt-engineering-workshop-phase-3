import type { CSSProperties } from "react";
import { prefersReducedMotion } from "./motion";

const COLORS = ["#d64545", "#2e9e5b", "#f5b700", "#3b82f6", "#a855f7", "#ff7ab6"];

interface ConfettiProps {
  /** Number of confetti pieces. Use more for bigger moments. */
  pieces?: number;
}

/**
 * A one-shot confetti burst over the whole page, for any celebration (a like streak, a match).
 * Render it with a new `key` to play it again. It is decorative: hidden from screen readers,
 * ignores the pointer and renders nothing when the user prefers reduced motion.
 */
export function Confetti({ pieces = 60 }: ConfettiProps) {
  if (prefersReducedMotion()) return null;
  return (
    <div className="confetti" data-testid="confetti" aria-hidden="true">
      {Array.from({ length: pieces }, (_, i) => (
        <span
          key={i}
          className="confetti-piece"
          // Spread the pieces with fixed steps instead of Math.random, so rendering stays pure.
          style={
            {
              left: `${(i * 37) % 100}%`,
              background: COLORS[i % COLORS.length],
              animationDelay: `${(i * 53) % 400}ms`,
              animationDuration: `${1200 + ((i * 71) % 800)}ms`,
              "--drift": `${((i * 29) % 160) - 80}px`,
              "--spin": `${((i * 97) % 720) - 360}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
