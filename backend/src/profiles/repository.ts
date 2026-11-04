export interface Profile {
  /** The same id that swipes are stored under, so a profile owns the user's swipes and likes. */
  userId: string;
  nickname: string;
  emoji: string;
}

/** Storage seam for profiles. Replace the in-memory implementation to use a real database. */
export interface ProfileRepository {
  get(userId: string): Profile | null;
  /** Creates the profile, or replaces the one stored for the same user id. */
  save(profile: Profile): void;
}

export function createInMemoryProfileRepository(): ProfileRepository {
  const profiles = new Map<string, Profile>();
  return {
    get: (userId) => {
      const profile = profiles.get(userId);
      return profile ? { ...profile } : null;
    },
    save: (profile) => {
      profiles.set(profile.userId, { ...profile });
    },
  };
}
