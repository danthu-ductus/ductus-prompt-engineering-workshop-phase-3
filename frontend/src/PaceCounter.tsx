/** The number of memes swiped by everyone in the last minute. */
export function PaceCounter({ memesPerMinute }: { memesPerMinute: number }) {
  return (
    <p className="pace" title="Memes swiped by everyone in the last minute">
      <span aria-hidden="true">⚡</span> {memesPerMinute} memes/min
    </p>
  );
}
