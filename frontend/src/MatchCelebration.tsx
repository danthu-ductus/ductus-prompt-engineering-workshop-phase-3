import { useEffect } from "react";
import type { Match } from "./api";
import { Confetti } from "./Confetti";
import { playMatchSound } from "./sound";

interface MatchCelebrationProps {
  match: Match;
  onClose: () => void;
}

/** The "It's a Match!" moment: full screen, with confetti and a jingle. Escape closes it. */
export function MatchCelebration({ match, onClose }: MatchCelebrationProps) {
  useEffect(() => {
    playMatchSound();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="match-overlay" role="dialog" aria-modal="true" aria-labelledby="match-title">
      <Confetti pieces={200} />
      <div className="match-card">
        <h2 id="match-title">It&apos;s a Match!</h2>
        <p className="match-people">
          <span aria-hidden="true">{match.me.emoji}</span> {match.me.nickname}{" "}
          <span aria-hidden="true">❤️</span> <span aria-hidden="true">{match.person.emoji}</span>{" "}
          {match.person.nickname}
        </p>
        <p>
          {match.score}% compatible across {match.sharedCount} memes
        </p>
        <button type="button" autoFocus onClick={onClose}>
          Keep swiping
        </button>
      </div>
    </div>
  );
}
