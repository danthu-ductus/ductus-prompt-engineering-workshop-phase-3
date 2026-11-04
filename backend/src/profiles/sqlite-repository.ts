import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { ProfileRepository } from "./repository.js";

/** A ProfileRepository that also owns a database connection, which can be closed. */
export interface SqliteProfileRepository extends ProfileRepository {
  close(): void;
}

/**
 * Stores profiles in a SQLite database file, so they survive restarts. It can share the file
 * with the swipe repository. Pass ":memory:" for a throwaway database (useful in tests).
 */
export function createSqliteProfileRepository(file: string): SqliteProfileRepository {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });

  const db = new DatabaseSync(file);
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      user_id TEXT PRIMARY KEY,
      nickname TEXT NOT NULL,
      emoji TEXT NOT NULL
    );
  `);

  const select = db.prepare("SELECT user_id, nickname, emoji FROM profiles WHERE user_id = ?");
  const upsert = db.prepare(`
    INSERT INTO profiles (user_id, nickname, emoji) VALUES (?, ?, ?)
    ON CONFLICT (user_id) DO UPDATE SET nickname = excluded.nickname, emoji = excluded.emoji
  `);

  return {
    get: (userId) => {
      const row = select.get(userId);
      return row
        ? { userId: String(row.user_id), nickname: String(row.nickname), emoji: String(row.emoji) }
        : null;
    },
    save: (profile) => {
      upsert.run(profile.userId, profile.nickname, profile.emoji);
    },
    close: () => db.close(),
  };
}
