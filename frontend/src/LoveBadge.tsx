import type { Love } from "./api";

/** How much users love a meme, for example "87% loved this". Shows nothing without the numbers. */
export function LoveBadge({ love }: { love?: Love }) {
  if (!love) return null;
  return (
    <p className="love-badge">
      {love.percent === null ? "Be the first to swipe" : `${love.percent}% loved this`}
    </p>
  );
}
