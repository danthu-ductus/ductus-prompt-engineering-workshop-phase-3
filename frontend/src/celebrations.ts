import type { Direction } from "./api";

/** Every this many likes in a row earns a confetti burst. */
export const STREAK_LENGTH = 5;

/** The lifetime swipe that gets a special celebration. */
export const MILESTONE_SWIPES = 100;

const STORAGE_KEY = "meme-tinder-swipe-count";

export type Celebration = { kind: "streak"; likes: number } | { kind: "milestone"; swipes: number };

/** The like streak after a swipe: a like adds one, a nope starts over. */
export function nextStreak(streak: number, direction: Direction): number {
  return direction === "like" ? streak + 1 : 0;
}

/** The celebration a swipe earns, if any. The milestone wins when both happen at once. */
export function celebrationFor(lifetimeSwipes: number, streak: number): Celebration | null {
  if (lifetimeSwipes === MILESTONE_SWIPES) return { kind: "milestone", swipes: lifetimeSwipes };
  if (streak > 0 && streak % STREAK_LENGTH === 0) return { kind: "streak", likes: streak };
  return null;
}

/**
 * Adds one to the number of swipes ever made in this browser and returns the new total.
 * Kept in localStorage, so it survives page reloads and Reset (which only clears the backend).
 */
export function countLifetimeSwipe(): number {
  try {
    const stored = Number(localStorage.getItem(STORAGE_KEY));
    const count = (Number.isFinite(stored) ? stored : 0) + 1;
    localStorage.setItem(STORAGE_KEY, String(count));
    return count;
  } catch {
    // localStorage unavailable (e.g. blocked): count for this page load only.
    return ++memoryCount;
  }
}

let memoryCount = 0;
