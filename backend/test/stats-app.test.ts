import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createCompatibilityService } from "../src/compatibility/service.js";
import { createInMemoryMatchRepository } from "../src/matches/repository.js";
import { createMatchService } from "../src/matches/service.js";
import { createMemeCatalog } from "../src/memes/catalog.js";
import { createInMemoryProfileRepository } from "../src/profiles/repository.js";
import { createProfileService } from "../src/profiles/service.js";
import { createStatsService } from "../src/stats/service.js";
import { createInMemorySwipeRepository } from "../src/swipes/repository.js";
import { createSwipeService } from "../src/swipes/service.js";

function setup() {
  const catalog = createMemeCatalog();
  const swipes = createInMemorySwipeRepository();
  const app = createApp(
    createSwipeService(catalog, swipes),
    createProfileService(createInMemoryProfileRepository()),
    createCompatibilityService(swipes, createInMemoryProfileRepository()),
    createMatchService(swipes, createInMemoryProfileRepository(), createInMemoryMatchRepository()),
    createStatsService(catalog, swipes),
  );
  return { app, memes: catalog.list(), swipes };
}

type App = ReturnType<typeof setup>["app"];

const swipe = (app: App, userId: string, memeId: string, direction: "like" | "nope") =>
  request(app).post("/api/swipes").set("X-User-Id", userId).send({ memeId, direction }).expect(200);

const stats = (app: App, userId = "u1") => request(app).get("/api/stats").set("X-User-Id", userId);

describe("GET /api/stats", () => {
  it("returns 400 without a user id", async () => {
    const res = await request(setup().app).get("/api/stats");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Missing X-User-Id header" });
  });

  it("returns 403 for a demo persona's id", async () => {
    const res = await stats(setup().app, "demo-larry");

    expect(res.status).toBe(403);
  });

  it("starts with zero memes per minute and an empty trending list", async () => {
    const res = await stats(setup().app);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ memesPerMinute: 0, trending: { period: "all-time", memes: [] } });
  });

  it("counts the swipes of every user in memes per minute", async () => {
    const { app, memes } = setup();
    await swipe(app, "u1", memes[0].id, "like");
    await swipe(app, "u1", memes[1].id, "nope");
    await swipe(app, "u2", memes[0].id, "like");

    expect((await stats(app)).body.memesPerMinute).toBe(3);
  });

  it("shows a meme as trending once enough users have swiped it, with its picture", async () => {
    const { app, memes } = setup();
    for (const user of ["u1", "u2", "u3"]) {
      for (const meme of memes.slice(0, 3)) await swipe(app, user, meme.id, "like");
    }

    const { trending } = (await stats(app)).body;

    expect(trending.period).toBe("hour");
    expect(trending.memes).toHaveLength(3);
    expect(trending.memes[0]).toEqual({
      meme: { id: memes[0].id, caption: memes[0].caption, imageUrl: memes[0].imageUrl },
      swipes: 3,
      percent: 100,
    });
  });

  it("does not count the demo personas", async () => {
    const { app, memes, swipes } = setup();
    swipes.add("demo-larry", { memeId: memes[0].id, direction: "like" });

    const res = await stats(app);

    expect(res.body.memesPerMinute).toBe(0);
    expect(res.body.trending.memes).toEqual([]);
  });
});

describe("love on memes", () => {
  it("has no percentage on a meme nobody has swiped", async () => {
    const { app } = setup();

    const res = await request(app).get("/api/memes/next").set("X-User-Id", "u1");

    expect(res.body.meme.love).toEqual({ percent: null, swipes: 0 });
  });

  it("shows how many of all users liked the meme, to every user", async () => {
    const { app, memes } = setup();
    await swipe(app, "u1", memes[0].id, "like");
    await swipe(app, "u2", memes[0].id, "like");
    await swipe(app, "u3", memes[0].id, "nope");

    const res = await request(app).get("/api/memes/next").set("X-User-Id", "u4");

    expect(res.body.meme).toMatchObject({ id: memes[0].id, love: { percent: 67, swipes: 3 } });
  });

  it("shows it on the liked memes as well", async () => {
    const { app, memes } = setup();
    await swipe(app, "u1", memes[0].id, "like");
    await swipe(app, "u2", memes[0].id, "nope");

    const res = await request(app).get("/api/likes").set("X-User-Id", "u1");

    expect(res.body.memes).toEqual([
      expect.objectContaining({ id: memes[0].id, love: { percent: 50, swipes: 2 } }),
    ]);
  });

  it("does not let the demo personas change the percentage", async () => {
    const { app, memes, swipes } = setup();
    swipes.add("demo-larry", { memeId: memes[0].id, direction: "like" });
    await swipe(app, "u1", memes[0].id, "nope");

    const next = await request(app).get("/api/memes/next").set("X-User-Id", "u2");

    expect(next.body.meme).toMatchObject({ id: memes[0].id, love: { percent: 0, swipes: 1 } });
  });
});
