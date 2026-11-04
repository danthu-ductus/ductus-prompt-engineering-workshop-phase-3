import { afterEach, describe, expect, it } from "vitest";
import {
  celebrationFor,
  countLifetimeSwipe,
  MILESTONE_SWIPES,
  nextStreak,
  STREAK_LENGTH,
} from "../src/celebrations";

afterEach(() => localStorage.clear());

describe("nextStreak", () => {
  it("adds one for a like and starts over on a nope", () => {
    expect(nextStreak(0, "like")).toBe(1);
    expect(nextStreak(4, "like")).toBe(5);
    expect(nextStreak(4, "nope")).toBe(0);
  });
});

describe("celebrationFor", () => {
  it("celebrates every full streak of likes", () => {
    expect(celebrationFor(1, STREAK_LENGTH - 1)).toBeNull();
    expect(celebrationFor(1, STREAK_LENGTH)).toEqual({ kind: "streak", likes: STREAK_LENGTH });
    expect(celebrationFor(1, STREAK_LENGTH + 1)).toBeNull();
    expect(celebrationFor(1, STREAK_LENGTH * 2)).toEqual({
      kind: "streak",
      likes: STREAK_LENGTH * 2,
    });
  });

  it("does not celebrate a streak of zero", () => {
    expect(celebrationFor(1, 0)).toBeNull();
  });

  it("celebrates the milestone swipe only once, and prefers it over a streak", () => {
    expect(celebrationFor(MILESTONE_SWIPES - 1, 0)).toBeNull();
    expect(celebrationFor(MILESTONE_SWIPES, STREAK_LENGTH)).toEqual({
      kind: "milestone",
      swipes: MILESTONE_SWIPES,
    });
    expect(celebrationFor(MILESTONE_SWIPES + 1, 0)).toBeNull();
  });
});

describe("countLifetimeSwipe", () => {
  it("counts up from zero and keeps the total in localStorage", () => {
    expect(countLifetimeSwipe()).toBe(1);
    expect(countLifetimeSwipe()).toBe(2);
    expect(localStorage.getItem("meme-tinder-swipe-count")).toBe("2");
  });

  it("continues from a stored total", () => {
    localStorage.setItem("meme-tinder-swipe-count", "99");

    expect(countLifetimeSwipe()).toBe(100);
  });
});
