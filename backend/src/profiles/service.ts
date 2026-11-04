import type { Profile, ProfileRepository } from "./repository.js";

export const NICKNAME_MAX_LENGTH = 30;

/** Emojis a new profile can get at random. Users may pick any single emoji afterwards. */
export const DEFAULT_EMOJIS = ["😎", "🐸", "🦄", "🐙", "🦊", "🐼", "🤖", "👽", "🐧", "🦖"];

const ADJECTIVES = ["Giggly", "Sneaky", "Cosmic", "Chaotic", "Sleepy", "Spicy", "Wobbly", "Sassy"];
const NOUNS = ["Penguin", "Pickle", "Raccoon", "Noodle", "Wizard", "Potato", "Llama", "Goblin"];

export class InvalidProfileError extends Error {}

export interface ProfileUpdate {
  nickname: string;
  emoji: string;
}

export interface ProfileService {
  /**
   * The user's profile. A user without one (including users who swiped before profiles existed)
   * gets a profile with a generated nickname and a random emoji. Their swipes are kept, because
   * the profile uses the same user id.
   */
  getProfile(userId: string): Profile;
  /** Sets nickname and emoji. Throws InvalidProfileError for invalid input. */
  updateProfile(userId: string, update: ProfileUpdate): Profile;
}

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

/** True for exactly one emoji, including emojis built from several code points (👩‍💻, 🇸🇪). */
export function isSingleEmoji(value: string): boolean {
  const graphemes = [...segmenter.segment(value)];
  return graphemes.length === 1 && EMOJI.test(value);
}

/** `random` returns a number in [0, 1), like Math.random. Pass a fixed one in tests. */
export function createProfileService(
  repository: ProfileRepository,
  random: () => number = Math.random,
): ProfileService {
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)];

  return {
    getProfile(userId) {
      const existing = repository.get(userId);
      if (existing) return existing;
      const profile = {
        userId,
        nickname: `${pick(ADJECTIVES)} ${pick(NOUNS)}`,
        emoji: pick(DEFAULT_EMOJIS),
      };
      repository.save(profile);
      return profile;
    },

    updateProfile(userId, update) {
      const nickname = update.nickname.trim();
      if (!nickname) throw new InvalidProfileError("nickname is required");
      if (nickname.length > NICKNAME_MAX_LENGTH) {
        throw new InvalidProfileError(`nickname must be at most ${NICKNAME_MAX_LENGTH} characters`);
      }
      if (!isSingleEmoji(update.emoji)) {
        throw new InvalidProfileError("emoji must be a single emoji");
      }
      const profile = { userId, nickname, emoji: update.emoji };
      repository.save(profile);
      return profile;
    },
  };
}
