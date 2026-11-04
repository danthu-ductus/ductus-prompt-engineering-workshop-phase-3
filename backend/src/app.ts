import express, { type NextFunction, type Request, type Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
  options: AppOptions = {},
) {
  const app = express();
  app.use(express.json());

  app.use(IMAGE_PATH, express.static(assetsDir));

  // 200 with { meme }. When the user has swiped every meme, meme is null.
  app.get("/api/memes/next", (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    res.json({ meme: swipeService.getNextMeme(userId) });
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

  // 200 with { memes }: the user's liked memes in catalog order, or an empty list.
  app.get("/api/likes", (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    res.json({ memes: swipeService.listLikedMemes(userId) });
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
