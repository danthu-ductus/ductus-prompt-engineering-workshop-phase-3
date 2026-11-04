import { getUserId } from "./identity";

export interface Meme {
  id: string;
  caption: string;
  imageUrl: string;
}

export type Direction = "like" | "nope";

export interface Profile {
  userId: string;
  nickname: string;
  emoji: string;
}

/** The API's own message ({ "error": "..." }) when there is one, otherwise the HTTP status. */
async function errorMessage(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json();
    if (typeof body === "object" && body !== null && "error" in body) {
      if (typeof body.error === "string") return body.error;
    }
  } catch {
    // The body is not JSON: fall back to the status.
  }
  return `Request failed (HTTP ${res.status})`;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { ...init.headers, "X-User-Id": getUserId() },
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.status === 204 ? (undefined as T) : res.json();
}

/** Resolves to null when the user has swiped every meme. */
export async function fetchNextMeme(): Promise<Meme | null> {
  const { meme } = await request<{ meme: Meme | null }>("/api/memes/next");
  return meme;
}

export async function sendSwipe(memeId: string, direction: Direction): Promise<void> {
  await request("/api/swipes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memeId, direction }),
  });
}

/** The memes the user has liked, in a stable order. */
export async function fetchLikes(): Promise<Meme[]> {
  const { memes } = await request<{ memes: Meme[] }>("/api/likes");
  return memes;
}

/** Removes all of the user's swipes, including likes. */
export async function resetSwipes(): Promise<void> {
  await request("/api/swipes", { method: "DELETE" });
}

/** The user's profile. A user without one gets a generated nickname and emoji. */
export async function fetchProfile(): Promise<Profile> {
  const { profile } = await request<{ profile: Profile }>("/api/profile");
  return profile;
}

/** Rejects with the API's message when the nickname or emoji is invalid. */
export async function updateProfile(nickname: string, emoji: string): Promise<Profile> {
  const { profile } = await request<{ profile: Profile }>("/api/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname, emoji }),
  });
  return profile;
}

/** Another user with a compatibility score. It never contains their user id or their swipes. */
export interface Person {
  /** A public id that is safe to show. It is not the user id. */
  id: string;
  nickname: string;
  emoji: string;
  /** True for a labeled demo persona, not a real person. */
  demo: boolean;
  /** How many memes both of you have swiped. */
  sharedCount: number;
  /** Percentage (0-100), or null until enough memes are swiped by both. */
  score: number | null;
  /** How many more memes you both need to swipe to get a score. */
  memesNeeded: number;
}

/** The other users, best match first. */
export async function fetchPeople(): Promise<Person[]> {
  const { people } = await request<{ people: Person[] }>("/api/people");
  return people;
}

/** A new match to celebrate. It never contains a user id. */
export interface Match {
  /** The other person's public id (the same one as in the people list). */
  id: string;
  me: { nickname: string; emoji: string; demo: boolean };
  person: { nickname: string; emoji: string; demo: boolean };
  /** The compatibility percentage when the match was made. */
  score: number;
  sharedCount: number;
}

/** Checks for new matches. Each match is returned once, so call it often but show what it returns. */
export async function checkMatches(): Promise<Match[]> {
  const { matches } = await request<{ matches: Match[] }>("/api/matches/check", {
    method: "POST",
  });
  return matches;
}
