import { useCallback, useEffect, useState } from "react";
import {
  checkMatches,
  fetchLikes,
  fetchNextMeme,
  fetchPeople,
  fetchProfile,
  fetchStats,
  resetSwipes,
  sendSwipe,
  updateProfile,
  type Direction,
  type Match,
  type Meme,
  type Person,
  type Profile,
  type Stats,
} from "./api";
import { celebrationFor, countLifetimeSwipe, nextStreak, type Celebration } from "./celebrations";
import { Confetti } from "./Confetti";
import { EmptyState } from "./EmptyState";
import { LikesView } from "./LikesView";
import { MatchCelebration } from "./MatchCelebration";
import { MemeCard } from "./MemeCard";
import { PaceCounter } from "./PaceCounter";
import { PeopleView } from "./PeopleView";
import { waitForFlyOut } from "./motion";
import { ProfileView } from "./ProfileView";
import { TrendingView } from "./TrendingView";

type View = "swipe" | "likes" | "trending" | "people" | "profile";

/** How long (in ms) a celebration message stays on screen. */
const CELEBRATION_MS = 3000;

/** How often (in ms) the app asks for new matches, so the other person of a pair sees theirs soon. */
const MATCH_CHECK_MS = 10_000;

/** How often (in ms) the Hot or Not numbers (memes per minute, Trending) are refreshed. */
const STATS_REFRESH_MS = 5000;

export function App() {
  const [view, setView] = useState<View>("swipe");
  const [meme, setMeme] = useState<Meme | null>(null);
  const [likes, setLikes] = useState<Meme[] | null>(null);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  /** The current celebration; `id` changes for every new one so the confetti plays again. */
  const [celebration, setCelebration] = useState<(Celebration & { id: number }) | null>(null);
  /** Changes when a swipe fails, so the card that flew off comes back. */
  const [failedSwipes, setFailedSwipes] = useState(0);
  /** New matches waiting to be celebrated, one after the other. */
  const [matches, setMatches] = useState<Match[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

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

  // The numbers only decorate the app, so a failed refresh keeps the last ones and the next
  // refresh tries again.
  const loadStats = useCallback(async () => {
    try {
      setStats(await fetchStats());
    } catch {
      // Keep showing the last numbers.
    }
  }, []);

  // A failed check is ignored: the next one (after a swipe or on the timer) tries again.
  const checkForMatches = useCallback(async () => {
    try {
      const found = await checkMatches();
      if (found.length > 0) setMatches((queue) => [...queue, ...found]);
    } catch {
      // Try again at the next check.
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(checkForMatches);
    const timer = setInterval(() => void checkForMatches(), MATCH_CHECK_MS);
    return () => clearInterval(timer);
  }, [checkForMatches]);

  useEffect(() => {
    void Promise.resolve().then(loadStats);
    const timer = setInterval(() => void loadStats(), STATS_REFRESH_MS);
    return () => clearInterval(timer);
  }, [loadStats]);

  useEffect(() => {
    if (!celebration) return;
    const timer = setTimeout(() => setCelebration(null), CELEBRATION_MS);
    return () => clearTimeout(timer);
  }, [celebration]);

  useEffect(() => {
    // Defer the first load so no state is set synchronously in the effect (react-hooks/set-state-in-effect).
    void Promise.resolve().then(load);
    void Promise.resolve().then(loadProfile);
  }, [load, loadProfile]);

  function showTrending() {
    setView("trending");
    setError(null);
    void loadStats();
  }

  async function showPeople() {
    setView("people");
    setPeople(null);
    setError(null);
    try {
      setPeople(await fetchPeople());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

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
      // Let the card fly off while the swipe is sent, then bring in the next one.
      await Promise.all([sendSwipe(meme.id, direction), waitForFlyOut()]);
      celebrate(direction);
      await load();
      void checkForMatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setFailedSwipes((count) => count + 1);
    } finally {
      setSwiping(false);
    }
  }

  function celebrate(direction: Direction) {
    const newStreak = nextStreak(streak, direction);
    setStreak(newStreak);
    const earned = celebrationFor(countLifetimeSwipe(), newStreak);
    if (earned) setCelebration((current) => ({ ...earned, id: (current?.id ?? 0) + 1 }));
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
          aria-current={view === "trending" ? "page" : undefined}
          onClick={showTrending}
        >
          Trending
        </button>
        <button
          type="button"
          aria-current={view === "people" ? "page" : undefined}
          onClick={showPeople}
        >
          People
        </button>
        <button
          type="button"
          aria-current={view === "profile" ? "page" : undefined}
          onClick={showProfile}
        >
          Profile
        </button>
      </nav>
      {stats && <PaceCounter memesPerMinute={stats.memesPerMinute} />}
      {error && <p role="alert">Something went wrong: {error}. Is the backend running?</p>}
      {view === "likes" && !error && (likes ? <LikesView memes={likes} /> : <p>Loading…</p>)}
      {view === "trending" &&
        !error &&
        (stats ? <TrendingView trending={stats.trending} /> : <p>Loading…</p>)}
      {view === "people" && !error && (people ? <PeopleView people={people} /> : <p>Loading…</p>)}
      {view === "profile" &&
        !error &&
        (profile ? <ProfileView profile={profile} onSave={saveProfile} /> : <p>Loading…</p>)}
      {view === "swipe" && loading && !error && <p>Loading…</p>}
      {view === "swipe" && !loading && !error && !meme && <EmptyState onReset={reset} />}
      {view === "swipe" && meme && (
        <MemeCard
          key={`${meme.id}:${failedSwipes}`}
          meme={meme}
          onSwipe={swipe}
          disabled={swiping || matches.length > 0}
        />
      )}
      {matches[0] && (
        <MatchCelebration
          key={matches[0].id}
          match={matches[0]}
          onClose={() => setMatches((queue) => queue.slice(1))}
        />
      )}
      {celebration && (
        <>
          <Confetti key={celebration.id} pieces={celebration.kind === "milestone" ? 150 : 60} />
          <p role="status" className={`celebration ${celebration.kind}`}>
            {celebration.kind === "milestone"
              ? `🎉 ${celebration.swipes} memes swiped! You are a legend.`
              : `🔥 ${celebration.likes} likes in a row!`}
          </p>
        </>
      )}
    </main>
  );
}
