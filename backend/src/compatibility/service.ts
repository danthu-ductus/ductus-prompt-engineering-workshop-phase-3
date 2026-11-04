import { createHash } from "node:crypto";
import type { ProfileRepository } from "../profiles/repository.js";
import type { Direction, Swipe, SwipeRepository } from "../swipes/repository.js";

/** A score needs at least this many memes swiped by both. Two memes are a coincidence. */
export const MIN_SHARED_MEMES = 5;

export interface Compatibility {
  /** How many memes both users have swiped. */
  sharedCount: number;
  /** Percentage (0-100) of the shared memes with the same choice, or null below the minimum. */
  score: number | null;
}

/**
 * Another user as seen by someone else. It never contains their user id (today that id is the
 * credential for the API) and never their swipes.
 */
export interface Person {
  /** A stable public id, derived from the user id with a one-way hash, that is safe to show. */
  id: string;
  nickname: string;
  emoji: string;
  sharedCount: number;
  score: number | null;
  /** How many more memes both need to swipe before there is a score. 0 when there is one. */
  memesNeeded: number;
}

export interface CompatibilityService {
  /** The other users with a compatibility score, best match first. Never includes the user. */
  listPeople(userId: string): Person[];
}

/** Public id of a user. One way, so it cannot be used to act as that user. */
export function publicId(userId: string): string {
  return createHash("sha256").update(userId).digest("hex").slice(0, 12);
}

function firstChoices(swipes: Swipe[]): Map<string, Direction> {
  const choices = new Map<string, Direction>();
  for (const swipe of swipes) {
    if (!choices.has(swipe.memeId)) choices.set(swipe.memeId, swipe.direction);
  }
  return choices;
}

/** Of the memes both have swiped, the share where they made the same choice. */
export function compareSwipes(mine: Swipe[], theirs: Swipe[]): Compatibility {
  const theirChoices = firstChoices(theirs);
  let sharedCount = 0;
  let same = 0;
  for (const [memeId, direction] of firstChoices(mine)) {
    const theirDirection = theirChoices.get(memeId);
    if (theirDirection === undefined) continue;
    sharedCount++;
    if (theirDirection === direction) same++;
  }
  const score = sharedCount >= MIN_SHARED_MEMES ? Math.round((same / sharedCount) * 100) : null;
  return { sharedCount, score };
}

/** People with a score first (highest first), then the ones still collecting memes in common. */
function byBestMatch(a: Person, b: Person): number {
  if (a.score !== null && b.score === null) return -1;
  if (a.score === null && b.score !== null) return 1;
  if (a.score !== null && b.score !== null && a.score !== b.score) return b.score - a.score;
  if (a.sharedCount !== b.sharedCount) return b.sharedCount - a.sharedCount;
  return a.nickname.localeCompare(b.nickname) || a.id.localeCompare(b.id);
}

export function createCompatibilityService(
  swipes: SwipeRepository,
  profiles: ProfileRepository,
): CompatibilityService {
  return {
    listPeople(userId) {
      const mine = swipes.listByUser(userId);
      return profiles
        .list()
        .filter((profile) => profile.userId !== userId)
        .map((profile) => {
          const { sharedCount, score } = compareSwipes(mine, swipes.listByUser(profile.userId));
          return {
            id: publicId(profile.userId),
            nickname: profile.nickname,
            emoji: profile.emoji,
            sharedCount,
            score,
            memesNeeded: Math.max(0, MIN_SHARED_MEMES - sharedCount),
          };
        })
        .sort(byBestMatch);
    },
  };
}
