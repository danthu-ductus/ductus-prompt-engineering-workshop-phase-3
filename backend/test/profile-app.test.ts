import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createCompatibilityService } from "../src/compatibility/service.js";
import { createMemeCatalog } from "../src/memes/catalog.js";
import { createInMemoryProfileRepository } from "../src/profiles/repository.js";
import { createProfileService } from "../src/profiles/service.js";
import { createInMemorySwipeRepository } from "../src/swipes/repository.js";
import { createSwipeService } from "../src/swipes/service.js";

function setup() {
  return createApp(
    createSwipeService(createMemeCatalog(), createInMemorySwipeRepository()),
    createProfileService(createInMemoryProfileRepository()),
    createCompatibilityService(createInMemorySwipeRepository(), createInMemoryProfileRepository()),
  );
}

type App = ReturnType<typeof setup>;

const getProfile = (app: App, userId: string) =>
  request(app).get("/api/profile").set("X-User-Id", userId);

const putProfile = (app: App, userId: string, body: object) =>
  request(app).put("/api/profile").set("X-User-Id", userId).send(body);

describe("GET /api/profile", () => {
  it("returns 400 without a user id", async () => {
    const res = await request(setup()).get("/api/profile");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Missing X-User-Id header" });
  });

  it("creates a profile with a nickname and emoji for a new user", async () => {
    const res = await getProfile(setup(), "u1");

    expect(res.status).toBe(200);
    expect(res.body.profile).toEqual({
      userId: "u1",
      nickname: expect.any(String),
      emoji: expect.any(String),
    });
    expect(res.body.profile.nickname).not.toBe("");
  });

  it("returns the same profile on the next request", async () => {
    const app = setup();
    const first = await getProfile(app, "u1");

    const second = await getProfile(app, "u1");

    expect(second.body).toEqual(first.body);
  });

  it("keeps the swipes and likes of a user who swiped before having a profile", async () => {
    const app = setup();
    const { body } = await request(app).get("/api/memes/next").set("X-User-Id", "u1");
    await request(app)
      .post("/api/swipes")
      .set("X-User-Id", "u1")
      .send({ memeId: body.meme.id, direction: "like" })
      .expect(200);

    const profile = await getProfile(app, "u1");
    const likes = await request(app).get("/api/likes").set("X-User-Id", "u1");

    expect(profile.status).toBe(200);
    expect(likes.body.memes.map((meme: { id: string }) => meme.id)).toEqual([body.meme.id]);
  });
});

describe("PUT /api/profile", () => {
  it("returns 400 without a user id", async () => {
    const res = await request(setup()).put("/api/profile").send({ nickname: "Sara", emoji: "🦄" });

    expect(res.status).toBe(400);
  });

  it("saves the nickname and emoji and returns the profile", async () => {
    const app = setup();

    const res = await putProfile(app, "u1", { nickname: " Sara ", emoji: "🦄" });

    expect(res.status).toBe(200);
    expect(res.body.profile).toEqual({ userId: "u1", nickname: "Sara", emoji: "🦄" });
    expect((await getProfile(app, "u1")).body.profile).toEqual(res.body.profile);
  });

  it("does not change the profile of another user", async () => {
    const app = setup();
    const other = (await getProfile(app, "u2")).body;

    await putProfile(app, "u1", { nickname: "Sara", emoji: "🦄" });

    expect((await getProfile(app, "u2")).body).toEqual(other);
  });

  it.each([
    ["no body", undefined],
    ["a missing emoji", { nickname: "Sara" }],
    ["a missing nickname", { emoji: "🦄" }],
    ["a nickname that is not text", { nickname: 5, emoji: "🦄" }],
    ["an empty nickname", { nickname: "  ", emoji: "🦄" }],
    ["a too long nickname", { nickname: "a".repeat(31), emoji: "🦄" }],
    ["an emoji that is not an emoji", { nickname: "Sara", emoji: "x" }],
    ["two emojis", { nickname: "Sara", emoji: "🦄🦄" }],
  ])("returns 400 with a JSON error for %s", async (_label, body) => {
    const app = setup();
    const before = (await getProfile(app, "u1")).body;

    const res = await putProfile(app, "u1", body ?? {});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: expect.any(String) });
    expect((await getProfile(app, "u1")).body).toEqual(before);
  });
});
