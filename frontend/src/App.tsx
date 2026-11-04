import { useCallback, useEffect, useState } from "react";
import {
  fetchLikes,
  fetchNextMeme,
  resetSwipes,
  sendSwipe,
  type Direction,
  type Meme,
} from "./api";
import { EmptyState } from "./EmptyState";
import { LikesView } from "./LikesView";
import { MemeCard } from "./MemeCard";

type View = "swipe" | "likes";

export function App() {
  const [view, setView] = useState<View>("swipe");
  const [meme, setMeme] = useState<Meme | null>(null);
  const [likes, setLikes] = useState<Meme[] | null>(null);
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
        <MemeCard key={meme.id} meme={meme} onSwipe={swipe} disabled={swiping} />
      )}
    </main>
  );
}
