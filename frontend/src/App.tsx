import { useCallback, useEffect, useState } from "react";
import {
  fetchLikes,
  fetchNextMeme,
  fetchProfile,
  resetSwipes,
  sendSwipe,
  updateProfile,
  type Direction,
  type Meme,
  type Profile,
} from "./api";
import { EmptyState } from "./EmptyState";
import { LikesView } from "./LikesView";
import { MemeCard } from "./MemeCard";
import { ProfileView } from "./ProfileView";

type View = "swipe" | "likes" | "profile";

export function App() {
  const [view, setView] = useState<View>("swipe");
  const [meme, setMeme] = useState<Meme | null>(null);
  const [likes, setLikes] = useState<Meme[] | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setMeme(await fetchNextMeme());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  // The profile only decorates the app, so a failure leaves the header empty instead of showing
  // an error. The meme request reports an unreachable backend.
  const loadProfile = useCallback(async () => {
    try {
      setProfile(await fetchProfile());
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    // Defer the first load so no state is set synchronously in the effect (react-hooks/set-state-in-effect).
    void Promise.resolve().then(load);
    void Promise.resolve().then(loadProfile);
  }, [load, loadProfile]);

  async function showProfile() {
    setView("profile");
    setError(null);
    if (!profile) await loadProfile();
  }

  async function saveProfile(nickname: string, emoji: string) {
    setProfile(await updateProfile(nickname, emoji));
  }

  async function showLikes() {
    setView("likes");
    setLikes(null);
    setError(null);
    try {
      setLikes(await fetchLikes());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  async function showSwipe() {
    setView("swipe");
    await load();
  }

  async function swipe(direction: Direction) {
    if (!meme || swiping) return;
    setError(null);
    setSwiping(true);
    try {
      await sendSwipe(meme.id, direction);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSwiping(false);
    }
  }

  async function reset() {
    setError(null);
    try {
      await resetSwipes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return;
    }
    await load();
  }

  return (
    <main>
      <h1>Meme-Tinder</h1>
      {profile && (
        <p className="profile-badge" aria-label="Signed in as">
          <span aria-hidden="true">{profile.emoji}</span> {profile.nickname}
        </p>
      )}
      <nav>
        <button
          type="button"
          aria-current={view === "swipe" ? "page" : undefined}
          onClick={showSwipe}
        >
          Swipe
        </button>
        <button
          type="button"
          aria-current={view === "likes" ? "page" : undefined}
          onClick={showLikes}
        >
          Likes
        </button>
        <button
          type="button"
          aria-current={view === "profile" ? "page" : undefined}
          onClick={showProfile}
        >
          Profile
        </button>
      </nav>
      {error && <p role="alert">Something went wrong: {error}. Is the backend running?</p>}
      {view === "likes" && !error && (likes ? <LikesView memes={likes} /> : <p>Loading…</p>)}
      {view === "profile" &&
        !error &&
        (profile ? <ProfileView profile={profile} onSave={saveProfile} /> : <p>Loading…</p>)}
      {view === "swipe" && loading && !error && <p>Loading…</p>}
      {view === "swipe" && !loading && !error && !meme && <EmptyState onReset={reset} />}
      {view === "swipe" && meme && (
        <MemeCard key={meme.id} meme={meme} onSwipe={swipe} disabled={swiping} />
      )}
    </main>
  );
}
