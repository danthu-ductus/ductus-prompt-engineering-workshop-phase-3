import express, { type NextFunction, type Request, type Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CompatibilityService } from "./compatibility/service.js";
import type { MatchService } from "./matches/service.js";
import type { Meme } from "./memes/catalog.js";
import type { StatsService } from "./stats/service.js";
import { isDemoUserId } from "./demo/personas.js";
import { IMAGE_PATH } from "./memes/catalog.js";
import { DIRECTIONS, type Direction } from "./swipes/repository.js";
import { InvalidProfileError, type ProfileService } from "./profiles/service.js";
import { UnknownMemeError, type SwipeService } from "./swipes/service.js";

const assetsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../assets/memes");

/** Returns the user id from the X-User-Id header, or sends 400 and returns null. */
function requireUserId(req: Request, res: Response): string | null {
  const userId = req.header("X-User-Id")?.trim();
  if (!userId) {
    res.status(400).json({ error: "Missing X-User-Id header" });
    return null;
  }
  // Demo personas are labeled stand-ins that cannot be signed in as.
  if (isDemoUserId(userId)) {
    res.status(403).json({ error: "This user id is reserved for demo profiles" });
    return null;
  }
  return userId;
}

function isDirection(value: unknown): value is Direction {
  return DIRECTIONS.includes(value as Direction);
}

export interface AppOptions {
  /** Directory with the built frontend. When set, it is served as static files with an SPA fallback. */
  staticDir?: string;
}

export function createApp(
  swipeService: SwipeService,
  profileService: ProfileService,
  compatibilityService: CompatibilityService,
  matchService: MatchService,
  statsService: StatsService,
  options: AppOptions = {},
) {
  const app = express();
  app.use(express.json());

  /** A meme as the API returns it: with how much users love it. */
  const withLove = (meme: Meme) => ({ ...meme, love: statsService.loveFor(meme.id) });

  app.use(IMAGE_PATH, express.static(assetsDir));

  // 200 with { meme }, a meme with its love ({ percent, swipes }). When the user has swiped every
  // meme, meme is null.
  app.get("/api/memes/next", (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    const meme = swipeService.getNextMeme(userId);
    res.json({ meme: meme && withLove(meme) });
  });

  // 200 with the stored swipe. Swiping the same meme twice keeps the first swipe.
  app.post("/api/swipes", (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    const { memeId, direction } = req.body ?? {};
    if (typeof memeId !== "string" || !memeId) {
      res.status(400).json({ error: "memeId is required" });
      return;
    }
    if (!isDirection(direction)) {
      res.status(400).json({ error: `direction must be one of: ${DIRECTIONS.join(", ")}` });
      return;
    }
    try {
      res.json(swipeService.recordSwipe(userId, memeId, direction));
    } catch (err) {
      if (err instanceof UnknownMemeError) {
        res.status(404).json({ error: err.message });
        return;
      }
      throw err;
    }
  });

  // 200 with { memes }: the user's liked memes in catalog order (each with its love), or an empty list.
  app.get("/api/likes", (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    res.json({ memes: swipeService.listLikedMemes(userId).map(withLove) });
  });

  // 204 No Content. Removes all of the user's swipes, including likes. Safe to repeat.
  app.delete("/api/swipes", (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    swipeService.resetSwipes(userId);
    res.status(204).end();
  });

  // 200 with { profile }. A user without a profile gets one (generated nickname, random emoji).
  app.get("/api/profile", (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    res.json({ profile: profileService.getProfile(userId) });
  });

  // 200 with { profile }. Body { nickname, emoji }; 400 for a missing or invalid nickname or emoji.
  app.put("/api/profile", (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    const { nickname, emoji } = req.body ?? {};
    if (typeof nickname !== "string" || typeof emoji !== "string") {
      res.status(400).json({ error: "nickname and emoji are required" });
      return;
    }
    try {
      res.json({ profile: profileService.updateProfile(userId, { nickname, emoji }) });
    } catch (err) {
      if (err instanceof InvalidProfileError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }
  });

  // 200 with { people }: every other user with a compatibility score, best match first.
  // Never exposes a user id or any swipes, only nickname, emoji, shared count and score.
  app.get("/api/people", (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    res.json({ people: compatibilityService.listPeople(userId) });
  });

  // 200 with { matches }: the user's new matches (compatibility of at least 70% with enough shared
  // memes) that they have not seen yet. A POST because it records that the user has seen them, so
  // each match is returned once per person.
  app.post("/api/matches/check", (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    res.json({ matches: matchService.takeNewMatches(userId) });
  });

  // 200 with { memesPerMinute, trending: { period, memes } }: the Hot or Not numbers across all
  // real users (never the demo personas). Trending is the last hour, or all time when the last
  // hour has too little data (period says which).
  app.get("/api/stats", (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    res.json(statsService.getStats());
  });

  // Built frontend (production only). Registered after the API routes and never answers /api paths.
  if (options.staticDir) {
    const staticDir = path.resolve(options.staticDir);
    app.use(express.static(staticDir));
    app.use((req, res, next) => {
      const isApiPath = req.path === "/api" || req.path.startsWith("/api/");
      if ((req.method !== "GET" && req.method !== "HEAD") || isApiPath) {
        next();
        return;
      }
      res.sendFile(path.join(staticDir, "index.html"));
    });
  }

  // Malformed JSON bodies and other client errors from middleware get a JSON error too.
  app.use(
    (
      err: { status?: number; message?: string },
      _req: Request,
      res: Response,
      _next: NextFunction,
    ) => {
      const status = err.status && err.status < 500 ? err.status : 500;
      res
        .status(status)
        .json({ error: status < 500 ? "Invalid request" : "Internal server error" });
    },
  );

  return app;
}
