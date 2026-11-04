import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { Direction, Meme } from "./api";
import { LoveBadge } from "./LoveBadge";

/** Horizontal drag distance (in px) a release must pass to count as a swipe. */
export const SWIPE_THRESHOLD = 100;

interface MemeCardProps {
  meme: Meme;
  onSwipe: (direction: Direction) => void;
  /** Ignores drags, buttons and arrow keys, e.g. while a swipe request is in flight. */
  disabled?: boolean;
}

export function MemeCard({ meme, onSwipe, disabled = false }: MemeCardProps) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  /** Set once the card is swiped: it shows the full stamp and flies off in this direction. */
  const [leaving, setLeaving] = useState<Direction | null>(null);
  const startX = useRef(0);

  function swipe(direction: Direction) {
    setLeaving(direction);
    onSwipe(direction);
  }

  useEffect(() => {
    if (disabled) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key === "ArrowRight") swipe("like");
      if (event.key === "ArrowLeft") swipe("nope");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (disabled) return;
    startX.current = event.clientX;
    setDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (dragging) setOffset(event.clientX - startX.current);
  }

  function onPointerUp(event: PointerEvent<HTMLElement>) {
    if (!dragging) return;
    const distance = event.clientX - startX.current;
    setDragging(false);
    if (distance >= SWIPE_THRESHOLD) swipe("like");
    else if (distance <= -SWIPE_THRESHOLD) swipe("nope");
    else setOffset(0);
  }

  function onPointerCancel() {
    setDragging(false);
    setOffset(0);
  }

  // The stamp and tint follow the drag: invisible at rest, full strength at the swipe threshold.
  const direction = leaving ?? (offset > 0 ? "like" : offset < 0 ? "nope" : null);
  const strength = leaving ? 1 : Math.min(Math.abs(offset) / SWIPE_THRESHOLD, 1);
  const opacityFor = (stamp: Direction) => (direction === stamp ? strength : 0);
  const transform = leaving
    ? `translateX(${leaving === "like" ? 150 : -150}%) rotate(${leaving === "like" ? 30 : -30}deg)`
    : `translateX(${offset}px) rotate(${offset / 20}deg)`;

  return (
    <>
      <figure
        className={`meme-card${dragging ? " dragging" : ""}${leaving ? " leaving" : ""}`}
        style={{ transform }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <img src={meme.imageUrl} alt={meme.caption} draggable={false} />
        <figcaption>{meme.caption}</figcaption>
        <LoveBadge love={meme.love} />
        <span
          className="tint tint-like"
          aria-hidden="true"
          style={{ opacity: opacityFor("like") }}
        />
        <span
          className="tint tint-nope"
          aria-hidden="true"
          style={{ opacity: opacityFor("nope") }}
        />
        <span
          className="stamp stamp-like"
          aria-hidden="true"
          style={{ opacity: opacityFor("like") }}
        >
          LIKE
        </span>
        <span
          className="stamp stamp-nope"
          aria-hidden="true"
          style={{ opacity: opacityFor("nope") }}
        >
          NOPE
        </span>
      </figure>
      <div className="actions">
        <button type="button" className="nope" disabled={disabled} onClick={() => swipe("nope")}>
          Nope
        </button>
        <button type="button" className="like" disabled={disabled} onClick={() => swipe("like")}>
          Like
        </button>
      </div>
    </>
  );
}
