import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Profile, ProfileRepository } from "./repository.js";

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
      emoji TEXT NOT NULL,
      demo INTEGER NOT NULL DEFAULT 0
    );
  `);
  // Databases made before demo profiles existed lack the column.
  const columns = db.prepare("PRAGMA table_info(profiles)").all();
  if (!columns.some((column) => column.name === "demo")) {
    db.exec("ALTER TABLE profiles ADD COLUMN demo INTEGER NOT NULL DEFAULT 0");
  }

  const select = db.prepare(
    "SELECT user_id, nickname, emoji, demo FROM profiles WHERE user_id = ?",
  );
  const selectAll = db.prepare(
    "SELECT user_id, nickname, emoji, demo FROM profiles ORDER BY rowid",
  );
  // A later update changes the nickname and emoji only, never whether it is a demo profile.
  const upsert = db.prepare(`
    INSERT INTO profiles (user_id, nickname, emoji, demo) VALUES (?, ?, ?, ?)
    ON CONFLICT (user_id) DO UPDATE SET nickname = excluded.nickname, emoji = excluded.emoji
  `);

  function toProfile(row: Record<string, unknown>): Profile {
    const profile: Profile = {
      userId: String(row.user_id),
      nickname: String(row.nickname),
      emoji: String(row.emoji),
    };
    // Only demo profiles carry the flag, so ordinary profiles look the same as before.
    return row.demo ? { ...profile, demo: true } : profile;
  }

  return {
    get: (userId) => {
      const row = select.get(userId);
      return row ? toProfile(row) : null;
    },
    list: () => selectAll.all().map(toProfile),
    save: (profile) => {
      upsert.run(profile.userId, profile.nickname, profile.emoji, profile.demo ? 1 : 0);
    },
    close: () => db.close(),
  };
}
