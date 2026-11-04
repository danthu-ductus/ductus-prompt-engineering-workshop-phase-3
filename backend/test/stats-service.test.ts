import { describe, expect, it } from "vitest";
import { createMemeCatalog } from "../src/memes/catalog.js";
import {
  createStatsService,
  MIN_TRENDING_MEMES,
  MIN_TRENDING_SWIPES,
  PACE_WINDOW_MS,
  TRENDING_SIZE,
  TRENDING_WINDOW_MS,
} from "../src/stats/service.js";
import { createInMemorySwipeRepository } from "../src/swipes/repository.js";
import type { Direction, SwipeRepository } from "../src/swipes/repository.js";
import { createSqliteSwipeRepository } from "../src/swipes/sqlite-repository.js";

const NOW = 10_000_000_000;
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const repositories: [string, () => SwipeRepository][] = [
  ["in-memory", createInMemorySwipeRepository],
  ["sqlite", () => createSqliteSwipeRepository(":memory:")],
];

const catalog = createMemeCatalog(
  ["a", "b", "c", "d", "e", "f", "g"].map((id) => ({
    id,
    caption: id.toUpperCase(),
    file: `${id}.svg`,
  })),
);

describe.each(repositories)("stats service with %s repository", (_name, createRepository) => {
  function setup() {
    const swipes = createRepository();
    const stats = createStatsService(catalog, swipes, { now: () => NOW });
    /** Records a swipe made `ageMs` ago. */
    const swipe = (userId: string, memeId: string, direction: Direction, ageMs = 0) =>
      swipes.add(userId, { memeId, direction }, NOW - ageMs);
    /** `likes` likes and `nopes` nopes on the meme, each by a different user, made `ageMs` ago. */
    const swipeMany = (memeId: string, likes: number, nopes: number, ageMs = 0) => {
      for (let i = 0; i < likes; i++) swipe(`${memeId}-like-${i}`, memeId, "like", ageMs);
      for (let i = 0; i < nopes; i++) swipe(`${memeId}-nope-${i}`, memeId, "nope", ageMs);
    };
    return { stats, swipe, swipeMany };
  }
  const trendingIds = (stats: ReturnType<typeof setup>["stats"]) =>
    stats.getStats().trending.memes.map((entry) => entry.meme.id);

  describe("loveFor", () => {
    it("has no percentage when nobody has swiped the meme", () => {
      expect(setup().stats.loveFor("a")).toEqual({ percent: null, swipes: 0 });
    });

    it("is the share of all users' swipes that were likes", () => {
      const { stats, swipeMany } = setup();
      swipeMany("a", 3, 1);

      expect(stats.loveFor("a")).toEqual({ percent: 75, swipes: 4 });
    });

    it("rounds to a whole percentage", () => {
      const { stats, swipeMany } = setup();
      swipeMany("a", 2, 1);

      expect(stats.loveFor("a").percent).toBe(67);
    });

    it("counts only swipes on that meme", () => {
      const { stats, swipeMany } = setup();
      swipeMany("a", 1, 0);
      swipeMany("b", 0, 3);

      expect(stats.loveFor("a")).toEqual({ percent: 100, swipes: 1 });
      expect(stats.loveFor("b")).toEqual({ percent: 0, swipes: 3 });
    });

    it("counts swipes of any age", () => {
      const { stats, swipe } = setup();
      swipe("u1", "a", "like", 30 * 24 * HOUR);

      expect(stats.loveFor("a")).toEqual({ percent: 100, swipes: 1 });
    });

    it("leaves out the demo personas", () => {
      const { stats, swipe } = setup();
      swipe("demo-larry", "a", "like");
      swipe("u1", "a", "nope");

      expect(stats.loveFor("a")).toEqual({ percent: 0, swipes: 1 });
    });

    it("has no percentage for a meme that does not exist", () => {
      const { stats, swipe } = setup();
      swipe("u1", "no-such-meme", "like");

      expect(stats.loveFor("no-such-meme")).toEqual({ percent: null, swipes: 0 });
    });
  });

  describe("memes per minute", () => {
    it("is 0 when nobody has swiped", () => {
      expect(setup().stats.getStats().memesPerMinute).toBe(0);
    });

    it("counts the swipes of all users in the last minute", () => {
      const { stats, swipe } = setup();
      swipe("u1", "a", "like", 0);
      swipe("u2", "a", "nope", 10 * 1000);
      swipe("u1", "b", "like", PACE_WINDOW_MS - 1);

      expect(stats.getStats().memesPerMinute).toBe(3);
    });

    it("does not count swipes from before the last minute", () => {
      const { stats, swipe } = setup();
      swipe("u1", "a", "like", PACE_WINDOW_MS);
      swipe("u2", "a", "like", 5 * MINUTE);

      expect(stats.getStats().memesPerMinute).toBe(0);
    });

    it("leaves out the demo personas", () => {
      const { stats, swipe } = setup();
      swipe("demo-larry", "a", "like");
      swipe("u1", "a", "like");

      expect(stats.getStats().memesPerMinute).toBe(1);
    });
  });

  describe("trending", () => {
    /** Four memes with enough swipes in the last hour, from most to least loved. */
    function fourMemesInTheLastHour() {
      const result = setup();
      result.swipeMany("a", 3, 0, 5 * MINUTE);
      result.swipeMany("b", 2, 1, 5 * MINUTE);
      result.swipeMany("c", 1, 2, 5 * MINUTE);
      result.swipeMany("d", 0, 3, 5 * MINUTE);
      return result;
    }

    it("is empty when no meme has enough swipes yet", () => {
      const { stats, swipeMany } = setup();
      swipeMany("a", MIN_TRENDING_SWIPES - 1, 0);

      expect(stats.getStats().trending).toEqual({ period: "all-time", memes: [] });
    });

    it("lists the memes of the last hour, best like rate first", () => {
      const { stats } = fourMemesInTheLastHour();

      const { trending } = stats.getStats();

      expect(trending.period).toBe("hour");
      expect(trending.memes.map((entry) => [entry.meme.id, entry.percent, entry.swipes])).toEqual([
        ["a", 100, 3],
        ["b", 67, 3],
        ["c", 33, 3],
        ["d", 0, 3],
      ]);
      expect(trending.memes[0].meme).toEqual({
        id: "a",
        caption: "A",
        imageUrl: expect.stringMatching(/a\.svg$/),
      });
    });

    it("leaves out memes with too few swipes, even with a perfect rate", () => {
      const { stats, swipeMany } = fourMemesInTheLastHour();
      swipeMany("e", MIN_TRENDING_SWIPES - 1, 0, 5 * MINUTE);

      expect(trendingIds(stats)).toEqual(["a", "b", "c", "d"]);
    });

    it("puts the meme with more swipes first when the like rate is the same", () => {
      const { stats, swipeMany } = fourMemesInTheLastHour();
      swipeMany("e", 5, 0, 5 * MINUTE);

      expect(trendingIds(stats).slice(0, 2)).toEqual(["e", "a"]);
    });

    it("only counts swipes from the last hour", () => {
      const { stats, swipeMany } = fourMemesInTheLastHour();
      // Plenty of old nopes on "a" must not pull it down in the hourly list.
      swipeMany("a", 0, 10, TRENDING_WINDOW_MS + MINUTE);

      const { trending } = stats.getStats();

      expect(trending.period).toBe("hour");
      expect(trending.memes[0]).toMatchObject({ meme: { id: "a" }, percent: 100, swipes: 3 });
    });

    it("falls back to all time, and says so, when the last hour has too little data", () => {
      const { stats, swipeMany } = setup();
      // Only two memes qualify in the last hour, which is fewer than MIN_TRENDING_MEMES.
      expect(MIN_TRENDING_MEMES).toBe(3);
      swipeMany("a", 3, 0, 5 * MINUTE);
      swipeMany("b", 0, 3, 5 * MINUTE);
      swipeMany("c", 3, 0, 2 * HOUR);

      const { trending } = stats.getStats();

      expect(trending.period).toBe("all-time");
      expect(trending.memes.map((entry) => entry.meme.id)).toEqual(["a", "c", "b"]);
    });

    it("shows at most TRENDING_SIZE memes", () => {
      const { stats, swipeMany } = setup();
      for (const id of ["a", "b", "c", "d", "e", "f", "g"]) swipeMany(id, 3, 0, MINUTE);

      expect(trendingIds(stats)).toHaveLength(TRENDING_SIZE);
    });

    it("leaves out the demo personas", () => {
      const { stats, swipe } = fourMemesInTheLastHour();
      for (const persona of ["demo-larry", "demo-greta", "demo-pia"]) {
        swipe(persona, "d", "like", MINUTE);
      }

      const d = stats.getStats().trending.memes.find((entry) => entry.meme.id === "d");

      expect(d).toMatchObject({ percent: 0, swipes: 3 });
    });
  });
});
