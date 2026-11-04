/** Two users who became compatible enough. Stored once per pair, whoever is first. */
export interface Match {
  userA: string;
  userB: string;
  /** The compatibility score (0-100) when the match was made. */
  score: number;
  /** How many memes both had swiped when the match was made. */
  sharedCount: number;
}

/** Storage seam for matches. Replace the in-memory implementation to use a real database. */
export interface MatchRepository {
  /** True when the pair has a match, in either order. */
  has(userA: string, userB: string): boolean;
  /** Stores a match, unseen by both users. Does nothing when the pair already has one. */
  add(match: Match): void;
  /** The user's matches that the user has not seen yet. */
  listUnseen(userId: string): Match[];
  /** Records that the user has seen the match with the other user. */
  markSeen(userId: string, otherUserId: string): void;
}

/** The same pair always gives the same two ids in the same order. */
export function orderPair(userA: string, userB: string): [string, string] {
  return userA <= userB ? [userA, userB] : [userB, userA];
}

export function createInMemoryMatchRepository(): MatchRepository {
  const entries = new Map<string, { match: Match; seenBy: Set<string> }>();
  const key = (userA: string, userB: string) => JSON.stringify(orderPair(userA, userB));
  return {
    has: (userA, userB) => entries.has(key(userA, userB)),
    add: (match) => {
      const k = key(match.userA, match.userB);
      if (!entries.has(k)) entries.set(k, { match: { ...match }, seenBy: new Set() });
    },
    listUnseen: (userId) =>
      [...entries.values()]
        .filter(
          ({ match, seenBy }) =>
            (match.userA === userId || match.userB === userId) && !seenBy.has(userId),
        )
        .map(({ match }) => ({ ...match })),
    markSeen: (userId, otherUserId) => {
      entries.get(key(userId, otherUserId))?.seenBy.add(userId);
    },
  };
}
