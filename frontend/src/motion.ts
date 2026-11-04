/** How long (in ms) a swiped card flies off before the next card comes in. Matches styles.css. */
export const FLY_OUT_MS = 300;

/** True when the user has asked the operating system for less motion. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Resolves when the fly-off animation is done, or right away when motion is reduced. */
export function waitForFlyOut(): Promise<void> {
  if (prefersReducedMotion()) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, FLY_OUT_MS));
}
