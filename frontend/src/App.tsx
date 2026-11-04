import { useCallback, useEffect, useState } from "react";
import {
  fetchLikes,
  fetchNextMeme,
  resetSwipes,
  sendSwipe,
  type Direction,
  type Meme,
} from "./api";
import { celebrationFor, countLifetimeSwipe, nextStreak, type Celebration } from "./celebrations";
import { Confetti } from "./Confetti";
import { EmptyState } from "./EmptyState";
import { LikesView } from "./LikesView";
import { MemeCard } from "./MemeCard";
import { waitForFlyOut } from "./motion";

type View = "swipe" | "likes";

/** How long (in ms) a celebration message stays on screen. */
const CELEBRATION_MS = 3000;

export function App() {
  const [view, setView] = useState<View>("swipe");
  const [meme, setMeme] = useState<Meme | null>(null);
  const [likes, setLikes] = useState<Meme[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  /** The current celebration; `id` changes for every new one so the confetti plays again. */
  const [celebration, setCelebration] = useState<(Celebration & { id: number }) | null>(null);
  /** Changes when a swipe fails, so the card that flew off comes back. */
  const [failedSwipes, setFailedSwipes] = useState(0);

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

  useEffect(() => {
    if (!celebration) return;
    const timer = setTimeout(() => setCelebration(null), CELEBRATION_MS);
    return () => clearTimeout(timer);
  }, [celebration]);

  useEffect(() => {
    // Defer the first load so no state is set synchronously in the effect (react-hooks/set-state-in-effect).
    void Promise.resolve().then(load);
  }, [load]);

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
      </nav>
      {error && <p role="alert">Something went wrong: {error}. Is the backend running?</p>}
      {view === "likes" && !error && (likes ? <LikesView memes={likes} /> : <p>Loading…</p>)}
      {view === "swipe" && loading && !error && <p>Loading…</p>}
      {view === "swipe" && !loading && !error && !meme && <EmptyState onReset={reset} />}
      {view === "swipe" && meme && (
        <MemeCard
          key={`${meme.id}:${failedSwipes}`}
          meme={meme}
          onSwipe={swipe}
          disabled={swiping}
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
