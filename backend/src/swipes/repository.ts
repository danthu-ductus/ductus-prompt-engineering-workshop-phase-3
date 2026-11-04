export type Direction = "like" | "nope";

export const DIRECTIONS: readonly Direction[] = ["like", "nope"];

export interface Swipe {
  memeId: string;
  direction: Direction;
}

/** A swipe together with who made it and when (milliseconds since the epoch). */
export interface StoredSwipe extends Swipe {
  userId: string;
  /** 0 for swipes stored before swipes had a time, so they never count as recent. */
  createdAt: number;
}

/** Storage seam for swipes. Replace the in-memory implementation to use a real database. */
export interface SwipeRepository {
  listByUser(userId: string): Swipe[];
  /** Stores a swipe. `createdAt` defaults to now. */
  add(userId: string, swipe: Swipe, createdAt?: number): void;
  clearByUser(userId: string): void;
  /** Every stored swipe of every user, in the order they were added. For statistics. */
  listAll(): StoredSwipe[];
}

export function createInMemorySwipeRepository(): SwipeRepository {
  let rows: StoredSwipe[] = [];
  return {
    listByUser: (userId) =>
      rows
        .filter((row) => row.userId === userId)
        .map(({ memeId, direction }) => ({ memeId, direction })),
    add: (userId, swipe, createdAt = Date.now()) => {
      rows = [...rows, { userId, memeId: swipe.memeId, direction: swipe.direction, createdAt }];
    },
    clearByUser: (userId) => {
      rows = rows.filter((row) => row.userId !== userId);
    },
    listAll: () => rows.map((row) => ({ ...row })),
  };
}
