import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Direction, Swipe, SwipeRepository } from "./repository.js";

/** A SwipeRepository that also owns a database connection, which can be closed. */
export interface SqliteSwipeRepository extends SwipeRepository {
  close(): void;
}

/**
 * Stores swipes in a SQLite database file, so they survive restarts.
 * Pass ":memory:" for a throwaway database (useful in tests).
 * Swipes are returned in the order they were added, like the in-memory repository.
 */
export function createSqliteSwipeRepository(file: string): SqliteSwipeRepository {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });

  const db = new DatabaseSync(file);
  db.exec(`
    CREATE TABLE IF NOT EXISTS swipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      meme_id TEXT NOT NULL,
      direction TEXT NOT NULL CHECK (direction IN ('like', 'nope'))
    );
    CREATE INDEX IF NOT EXISTS swipes_by_user ON swipes (user_id, id);
  `);

  const selectByUser = db.prepare(
    "SELECT meme_id, direction FROM swipes WHERE user_id = ? ORDER BY id",
  );
  const insert = db.prepare("INSERT INTO swipes (user_id, meme_id, direction) VALUES (?, ?, ?)");
  const deleteByUser = db.prepare("DELETE FROM swipes WHERE user_id = ?");

  return {
    listByUser: (userId) =>
      selectByUser.all(userId).map((row) => ({
        memeId: String(row.meme_id),
        direction: row.direction as Direction,
      })),
    add: (userId, swipe: Swipe) => {
      insert.run(userId, swipe.memeId, swipe.direction);
    },
    clearByUser: (userId) => {
      deleteByUser.run(userId);
    },
    close: () => db.close(),
  };
}
