import { compareSwipes, publicId } from "../compatibility/service.js";
import type { ProfileRepository } from "../profiles/repository.js";
import type { SwipeRepository } from "../swipes/repository.js";
import type { MatchRepository } from "./repository.js";

/** Two people match at this compatibility score (percent) or higher. */
export const MATCH_MIN_SCORE = 70;

export interface MatchedPerson {
  nickname: string;
  emoji: string;
  /** True for a labeled demo persona. */
  demo: boolean;
}

/** A match to celebrate. It never contains a user id (today that id is the API credential). */
export interface NewMatch {
  /** The public id of the other person, the same one `GET /api/people` uses. */
  id: string;
  me: MatchedPerson;
  person: MatchedPerson;
  score: number;
  sharedCount: number;
}

export interface MatchService {
  /**
   * Looks for people the user now matches (compatibility of at least MATCH_MIN_SCORE, which also
   * needs enough memes swiped by both), stores each new match once for the pair, and returns the
   * user's matches they have not seen yet. Every match is returned only once per person, so both
   * people of a pair get the celebration, each the next time they check. A match is never made
   * again when the score drops later.
   */
  takeNewMatches(userId: string): NewMatch[];
}

export function createMatchService(
  swipes: SwipeRepository,
  profiles: ProfileRepository,
  matches: MatchRepository,
): MatchService {
  return {
    takeNewMatches(userId) {
      const me = profiles.get(userId);
      if (!me) return [];

      const mine = swipes.listByUser(userId);
      for (const other of profiles.list()) {
        if (other.userId === userId || matches.has(userId, other.userId)) continue;
        const { sharedCount, score } = compareSwipes(mine, swipes.listByUser(other.userId));
        if (score !== null && score >= MATCH_MIN_SCORE) {
          matches.add({ userA: userId, userB: other.userId, score, sharedCount });
        }
      }

      const result: NewMatch[] = [];
      for (const match of matches.listUnseen(userId)) {
        const otherId = match.userA === userId ? match.userB : match.userA;
        matches.markSeen(userId, otherId);
        const other = profiles.get(otherId);
        if (!other) continue;
        result.push({
          id: publicId(otherId),
          me: { nickname: me.nickname, emoji: me.emoji, demo: me.demo === true },
          person: { nickname: other.nickname, emoji: other.emoji, demo: other.demo === true },
          score: match.score,
          sharedCount: match.sharedCount,
        });
      }
      return result;
    },
  };
}
