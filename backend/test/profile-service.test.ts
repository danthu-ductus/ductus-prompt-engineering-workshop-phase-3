import { describe, expect, it } from "vitest";
import { createInMemoryProfileRepository } from "../src/profiles/repository.js";
import type { ProfileRepository } from "../src/profiles/repository.js";
import {
  createProfileService,
  InvalidProfileError,
  isSingleEmoji,
  NICKNAME_MAX_LENGTH,
} from "../src/profiles/service.js";
import { createSqliteProfileRepository } from "../src/profiles/sqlite-repository.js";

// The same behavior must hold for every ProfileRepository implementation.
const repositories: [string, () => ProfileRepository][] = [
  ["in-memory", createInMemoryProfileRepository],
  ["sqlite", () => createSqliteProfileRepository(":memory:")],
];

describe.each(repositories)("profile service with %s storage", (_name, createRepository) => {
  // A fixed "random" makes the generated profile predictable.
  const setup = () => createProfileService(createRepository(), () => 0);

  it("gives a user without a profile a generated nickname and an emoji", () => {
    const profile = setup().getProfile("u1");

    expect(profile).toEqual({ userId: "u1", nickname: "Giggly Penguin", emoji: "😎" });
  });

  it("returns the same profile on every call", () => {
    let calls = 0;
    const service = createProfileService(createRepository(), () => (calls++ % 8) / 8);

    const first = service.getProfile("u1");

    expect(service.getProfile("u1")).toEqual(first);
    expect(service.getProfile("u1")).toEqual(first);
  });

  it("keeps profiles of different users apart", () => {
    const service = setup();

    service.updateProfile("u1", { nickname: "Sara", emoji: "🦄" });

    expect(service.getProfile("u1").nickname).toBe("Sara");
    expect(service.getProfile("u2").nickname).toBe("Giggly Penguin");
  });

  it("saves a trimmed nickname and the chosen emoji", () => {
    const service = setup();

    const updated = service.updateProfile("u1", { nickname: "  Sara  ", emoji: "🦄" });

    expect(updated).toEqual({ userId: "u1", nickname: "Sara", emoji: "🦄" });
    expect(service.getProfile("u1")).toEqual(updated);
  });

  it("accepts a nickname of exactly the maximum length", () => {
    const nickname = "a".repeat(NICKNAME_MAX_LENGTH);

    expect(setup().updateProfile("u1", { nickname, emoji: "🦄" }).nickname).toBe(nickname);
  });

  it.each([
    ["an empty nickname", { nickname: "", emoji: "🦄" }],
    ["a nickname of only spaces", { nickname: "   ", emoji: "🦄" }],
    ["a nickname that is too long", { nickname: "a".repeat(NICKNAME_MAX_LENGTH + 1), emoji: "🦄" }],
    ["an empty emoji", { nickname: "Sara", emoji: "" }],
    ["a letter instead of an emoji", { nickname: "Sara", emoji: "a" }],
    ["two emojis", { nickname: "Sara", emoji: "🦄🦄" }],
    ["an emoji followed by text", { nickname: "Sara", emoji: "🦄x" }],
  ])("rejects %s and keeps the old profile", (_label, update) => {
    const service = setup();
    const before = service.getProfile("u1");

    expect(() => service.updateProfile("u1", update)).toThrow(InvalidProfileError);
    expect(service.getProfile("u1")).toEqual(before);
  });
});

describe("isSingleEmoji", () => {
  it.each(["😎", "👩‍💻", "🇸🇪", "👍🏽", "❤️"])("accepts %s", (value) => {
    expect(isSingleEmoji(value)).toBe(true);
  });

  it.each(["", "a", "1", "😎😎", "😎a"])("rejects %j", (value) => {
    expect(isSingleEmoji(value)).toBe(false);
  });
});
