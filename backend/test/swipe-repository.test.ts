import { describe, expect, it } from "vitest";
import { createInMemorySwipeRepository } from "../src/swipes/repository.js";
import type { SwipeRepository } from "../src/swipes/repository.js";
import { createSqliteSwipeRepository } from "../src/swipes/sqlite-repository.js";

// The same behavior for every SwipeRepository implementation.
const repositories: [string, () => SwipeRepository][] = [
  ["in-memory", createInMemorySwipeRepository],
  ["sqlite", () => createSqliteSwipeRepository(":memory:")],
];

describe.each(repositories)("%s swipe repository", (_name, createRepository) => {
  it("lists the swipes of every user with who and when, in the order they were added", () => {
    const repository = createRepository();
    repository.add("u1", { memeId: "a", direction: "like" }, 1000);
    repository.add("u2", { memeId: "b", direction: "nope" }, 2000);
    repository.add("u1", { memeId: "c", direction: "like" }, 3000);

    expect(repository.listAll()).toEqual([
      { userId: "u1", memeId: "a", direction: "like", createdAt: 1000 },
      { userId: "u2", memeId: "b", direction: "nope", createdAt: 2000 },
      { userId: "u1", memeId: "c", direction: "like", createdAt: 3000 },
    ]);
  });

  it("stamps a swipe with the current time when none is given", () => {
    const repository = createRepository();
    const before = Date.now();

    repository.add("u1", { memeId: "a", direction: "like" });

    const [stored] = repository.listAll();
    expect(stored.createdAt).toBeGreaterThanOrEqual(before);
    expect(stored.createdAt).toBeLessThanOrEqual(Date.now());
  });

  it("still lists a user's swipes without the time", () => {
    const repository = createRepository();
    repository.add("u1", { memeId: "a", direction: "like" }, 1000);

    expect(repository.listByUser("u1")).toEqual([{ memeId: "a", direction: "like" }]);
  });

  it("removes a cleared user's swipes from the full list too", () => {
    const repository = createRepository();
    repository.add("u1", { memeId: "a", direction: "like" });
    repository.add("u2", { memeId: "a", direction: "nope" });

    repository.clearByUser("u1");

    expect(repository.listAll().map((swipe) => swipe.userId)).toEqual(["u2"]);
  });

  it("is empty when nothing has been swiped", () => {
    expect(createRepository().listAll()).toEqual([]);
  });
});
