import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { orderPair, type MatchRepository } from "./repository.js";

/** A MatchRepository that also owns a database connection, which can be closed. */
export interface SqliteMatchRepository extends MatchRepository {
  close(): void;
}

/**
 * Stores matches in a SQLite database file, so they survive restarts. It can share the file with
 * the swipe and profile repositories. Pass ":memory:" for a throwaway database (useful in tests).
 */
export function createSqliteMatchRepository(file: string): SqliteMatchRepository {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });

  const db = new DatabaseSync(file);
  // The pair is stored in a fixed order (see orderPair), so a pair has exactly one row.
  db.exec(`
    CREATE TABLE IF NOT EXISTS matches (
      user_a TEXT NOT NULL,
      user_b TEXT NOT NULL,
      score INTEGER NOT NULL,
      shared_count INTEGER NOT NULL,
      seen_a INTEGER NOT NULL DEFAULT 0,
      seen_b INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_a, user_b)
    );
  `);

  const exists = db.prepare("SELECT 1 FROM matches WHERE user_a = ? AND user_b = ?");
  const insert = db.prepare(
    "INSERT OR IGNORE INTO matches (user_a, user_b, score, shared_count) VALUES (?, ?, ?, ?)",
  );
  const selectUnseen = db.prepare(`
    SELECT user_a, user_b, score, shared_count FROM matches
    WHERE (user_a = ? AND seen_a = 0) OR (user_b = ? AND seen_b = 0)
    ORDER BY rowid
  `);
  const markSeenA = db.prepare("UPDATE matches SET seen_a = 1 WHERE user_a = ? AND user_b = ?");
  const markSeenB = db.prepare("UPDATE matches SET seen_b = 1 WHERE user_a = ? AND user_b = ?");

  return {
    has: (userA, userB) => exists.get(...orderPair(userA, userB)) !== undefined,
    add: (match) => {
      const [a, b] = orderPair(match.userA, match.userB);
      insert.run(a, b, match.score, match.sharedCount);
    },
    listUnseen: (userId) =>
      selectUnseen.all(userId, userId).map((row) => ({
        userA: String(row.user_a),
        userB: String(row.user_b),
        score: Number(row.score),
        sharedCount: Number(row.shared_count),
      })),
    markSeen: (userId, otherUserId) => {
      const [a, b] = orderPair(userId, otherUserId);
      (userId === a ? markSeenA : markSeenB).run(a, b);
    },
    close: () => db.close(),
  };
}
