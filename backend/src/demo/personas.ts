/** Demo profiles have user ids that start with this. Real users can never use such an id. */
export const DEMO_USER_PREFIX = "demo-";

export function isDemoUserId(userId: string): boolean {
  return userId.startsWith(DEMO_USER_PREFIX);
}

export interface DemoPersona {
  /** Short, fixed name for the user id. Never change it, or the persona is seeded twice. */
  key: string;
  nickname: string;
  emoji: string;
  /** Whether the persona likes the meme at this position in the catalog (otherwise it nopes it). */
  likes: (position: number) => boolean;
}

/**
 * Personas with very different, fixed tastes, so that someone who swipes a few memes is likely
 * to be compatible with at least one of them, whatever they like. Each persona has swiped every
 * meme, so a score is possible as soon as the user has swiped enough memes.
 */
export const DEMO_PERSONAS: readonly DemoPersona[] = [
  { key: "larry", nickname: "Like-It-All Larry", emoji: "🤩", likes: () => true },
  { key: "greta", nickname: "Grumpy Greta", emoji: "😒", likes: (position) => position % 10 === 7 },
  { key: "steven", nickname: "Even Steven", emoji: "🎲", likes: (position) => position % 2 === 0 },
  { key: "todd", nickname: "Odd Todd", emoji: "🦆", likes: (position) => position % 2 === 1 },
  { key: "pia", nickname: "Picky Pia", emoji: "🧐", likes: (position) => position % 3 === 0 },
  {
    key: "sam",
    nickname: "Streaky Sam",
    emoji: "🏄",
    likes: (position) => Math.floor(position / 3) % 2 === 0,
  },
];

export function demoUserId(persona: DemoPersona): string {
  return `${DEMO_USER_PREFIX}${persona.key}`;
}
