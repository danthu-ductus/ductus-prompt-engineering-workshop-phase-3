import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createCompatibilityService } from "../src/compatibility/service.js";
import { createInMemoryProfileRepository } from "../src/profiles/repository.js";
import { createInMemorySwipeRepository } from "../src/swipes/repository.js";
import { createMemeCatalog } from "../src/memes/catalog.js";
import { createProfileService } from "../src/profiles/service.js";
import { createSqliteProfileRepository } from "../src/profiles/sqlite-repository.js";
import { createSwipeService } from "../src/swipes/service.js";
import { createSqliteSwipeRepository } from "../src/swipes/sqlite-repository.js";

// These tests use a real database file and open it again to simulate a restart.
let dir: string;
let file: string;
const open: { close(): void }[] = [];

function openRepository() {
  const repository = createSqliteSwipeRepository(file);
  open.push(repository);
  return repository;
}

function openProfileRepository() {
  const repository = createSqliteProfileRepository(file);
  open.push(repository);
  return repository;
}

/** Closes every connection to the file, like a stopped server. */
function restart() {
  while (open.length > 0) open.pop()?.close();
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "meme-tinder-"));
  file = join(dir, "nested", "swipes.db");
});

afterEach(() => {
  restart();
  rmSync(dir, { recursive: true, force: true });
});

describe("sqlite swipe repository", () => {
  it("creates the database file and its folder", () => {
    openRepository().add("u1", { memeId: "a", direction: "like" });
    restart();

    expect(openRepository().listByUser("u1")).toEqual([{ memeId: "a", direction: "like" }]);
  });

  it("keeps swipes in the order they were added after a restart", () => {
    const before = openRepository();
    before.add("u1", { memeId: "b", direction: "nope" });
    before.add("u1", { memeId: "a", direction: "like" });
    restart();

    expect(openRepository().listByUser("u1")).toEqual([
      { memeId: "b", direction: "nope" },
      { memeId: "a", direction: "like" },
    ]);
  });

  it("removes a cleared user's swipes from the file", () => {
    const before = openRepository();
    before.add("u1", { memeId: "a", direction: "like" });
    before.add("u2", { memeId: "a", direction: "nope" });
    before.clearByUser("u1");
    restart();

    const after = openRepository();
    expect(after.listByUser("u1")).toEqual([]);
    expect(after.listByUser("u2")).toEqual([{ memeId: "a", direction: "nope" }]);
  });
});

describe("API with sqlite storage across a restart", () => {
  const catalog = createMemeCatalog();
  const startApp = () =>
    createApp(
      createSwipeService(catalog, openRepository()),
      createProfileService(openProfileRepository()),
      createCompatibilityService(
        createInMemorySwipeRepository(),
        createInMemoryProfileRepository(),
      ),
    );
  const memes = catalog.list();

  it("keeps likes after ten swipes and a restart", async () => {
    const app = startApp();
    const liked: string[] = [];
    for (const [index, meme] of memes.slice(0, 10).entries()) {
      const direction = index % 2 === 0 ? "like" : "nope";
      if (direction === "like") liked.push(meme.id);
      await request(app)
        .post("/api/swipes")
        .set("X-User-Id", "u1")
        .send({ memeId: meme.id, direction })
        .expect(200);
    }
    restart();

    const res = await request(startApp()).get("/api/likes").set("X-User-Id", "u1");

    expect(res.status).toBe(200);
    expect(res.body.memes.map((meme: { id: string }) => meme.id)).toEqual(liked);
  });

  it("does not serve already swiped memes again after a restart", async () => {
    const app = startApp();
    for (const meme of memes.slice(0, 3)) {
      await request(app)
        .post("/api/swipes")
        .set("X-User-Id", "u1")
        .send({ memeId: meme.id, direction: "nope" })
        .expect(200);
    }
    restart();

    const res = await request(startApp()).get("/api/memes/next").set("X-User-Id", "u1");

    expect(res.body.meme.id).toBe(memes[3].id);
  });

  it("still starts over after a reset and a restart", async () => {
    const app = startApp();
    await request(app)
      .post("/api/swipes")
      .set("X-User-Id", "u1")
      .send({ memeId: memes[0].id, direction: "like" })
      .expect(200);
    await request(app).delete("/api/swipes").set("X-User-Id", "u1").expect(204);
    restart();

    const restarted = startApp();
    const likes = await request(restarted).get("/api/likes").set("X-User-Id", "u1");
    const next = await request(restarted).get("/api/memes/next").set("X-User-Id", "u1");

    expect(likes.body.memes).toEqual([]);
    expect(next.body.meme.id).toBe(memes[0].id);
  });
});

describe("profiles with sqlite storage across a restart", () => {
  const catalog = createMemeCatalog();
  const startApp = () =>
    createApp(
      createSwipeService(catalog, openRepository()),
      createProfileService(openProfileRepository()),
      createCompatibilityService(
        createInMemorySwipeRepository(),
        createInMemoryProfileRepository(),
      ),
    );

  it("keeps the profile and the likes of a user after a restart", async () => {
    const app = startApp();
    const [meme] = catalog.list();
    await request(app)
      .post("/api/swipes")
      .set("X-User-Id", "u1")
      .send({ memeId: meme.id, direction: "like" })
      .expect(200);
    await request(app)
      .put("/api/profile")
      .set("X-User-Id", "u1")
      .send({ nickname: "Sara", emoji: "🦄" })
      .expect(200);
    restart();

    const restarted = startApp();
    const profile = await request(restarted).get("/api/profile").set("X-User-Id", "u1");
    const likes = await request(restarted).get("/api/likes").set("X-User-Id", "u1");

    expect(profile.body.profile).toEqual({ userId: "u1", nickname: "Sara", emoji: "🦄" });
    expect(likes.body.memes.map((m: { id: string }) => m.id)).toEqual([meme.id]);
  });

  it("keeps a generated profile after a restart instead of generating a new one", async () => {
    const first = await request(startApp()).get("/api/profile").set("X-User-Id", "u1");
    restart();

    const second = await request(startApp()).get("/api/profile").set("X-User-Id", "u1");

    expect(second.body).toEqual(first.body);
  });
});
