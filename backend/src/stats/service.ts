import { isDemoUserId } from "../demo/personas.js";
import type { Meme, MemeCatalog } from "../memes/catalog.js";
import type { StoredSwipe, SwipeRepository } from "../swipes/repository.js";

/** "Trending" looks at the swipes of the last hour. */
export const TRENDING_WINDOW_MS = 60 * 60 * 1000;

/** A meme needs this many swipes in the period to be trending, so one lucky like does not top it. */
export const MIN_TRENDING_SWIPES = 3;

/** If fewer memes than this qualify in the last hour, Trending falls back to all time. */
export const MIN_TRENDING_MEMES = 3;

/** How many memes the Trending list shows. */
export const TRENDING_SIZE = 5;

/** Memes per minute is the number of swipes in the last minute. */
export const PACE_WINDOW_MS = 60 * 1000;

/** How much users love a meme: the share of all swipes on it that were likes. */
export interface MemeLove {
  /** Percentage (0-100), or null when nobody has swiped the meme yet. */
  percent: number | null;
  /** How many swipes the percentage is based on. */
  swipes: number;
}

export interface TrendingMeme {
  meme: Meme;
  swipes: number;
  /** Percentage (0-100) of the swipes in the period that were likes. */
  percent: number;
}

export type TrendingPeriod = "hour" | "all-time";

export interface Stats {
  /** Swipes made by all users in the last minute. */
  memesPerMinute: number;
  trending: {
    /** "all-time" when the last hour had too little data. */
    period: TrendingPeriod;
    /** Best first. Can be empty when too few memes have been swiped. */
    memes: TrendingMeme[];
  };
}

export interface StatsService {
  /** How much users love the meme. Counts only real users, never the demo personas. */
  loveFor(memeId: string): MemeLove;
  getStats(): Stats;
}

export interface StatsOptions {
  /** The current time in milliseconds. Replace it in tests to control the clock. */
  now?: () => number;
}

interface Tally {
  likes: number;
  swipes: number;
}

function percentOf({ likes, swipes }: Tally): number {
  return Math.round((likes / swipes) * 100);
}

export function createStatsService(
  catalog: MemeCatalog,
  swipes: SwipeRepository,
  options: StatsOptions = {},
): StatsService {
  const now = options.now ?? Date.now;

  /** The swipes that count: real users only, on memes that exist. */
  function countedSwipes(): StoredSwipe[] {
    return swipes
      .listAll()
      .filter((swipe) => !isDemoUserId(swipe.userId) && catalog.getById(swipe.memeId));
  }

  function tallyByMeme(list: StoredSwipe[]): Map<string, Tally> {
    const tallies = new Map<string, Tally>();
    for (const swipe of list) {
      const tally = tallies.get(swipe.memeId) ?? { likes: 0, swipes: 0 };
      tally.swipes++;
      if (swipe.direction === "like") tally.likes++;
      tallies.set(swipe.memeId, tally);
    }
    return tallies;
  }

  /** The memes with enough swipes, best like rate first. Ties go to more swipes, then catalog order. */
  function rank(tallies: Map<string, Tally>): TrendingMeme[] {
    return catalog
      .list()
      .map((meme) => ({ meme, tally: tallies.get(meme.id) }))
      .filter(
        (entry): entry is { meme: Meme; tally: Tally } =>
          entry.tally !== undefined && entry.tally.swipes >= MIN_TRENDING_SWIPES,
      )
      .map(({ meme, tally }) => ({ meme, swipes: tally.swipes, percent: percentOf(tally) }))
      .sort((a, b) => b.percent - a.percent || b.swipes - a.swipes);
  }

  return {
    loveFor(memeId) {
      const tally = tallyByMeme(countedSwipes().filter((swipe) => swipe.memeId === memeId)).get(
        memeId,
      );
      return tally
        ? { percent: percentOf(tally), swipes: tally.swipes }
        : { percent: null, swipes: 0 };
    },

    getStats() {
      const time = now();
      const counted = countedSwipes();

      const lastHour = rank(
        tallyByMeme(counted.filter((swipe) => swipe.createdAt > time - TRENDING_WINDOW_MS)),
      );
      const trending =
        lastHour.length >= MIN_TRENDING_MEMES
          ? { period: "hour" as const, memes: lastHour }
          : { period: "all-time" as const, memes: rank(tallyByMeme(counted)) };

      return {
        memesPerMinute: counted.filter((swipe) => swipe.createdAt > time - PACE_WINDOW_MS).length,
        trending: { ...trending, memes: trending.memes.slice(0, TRENDING_SIZE) },
      };
    },
  };
}
