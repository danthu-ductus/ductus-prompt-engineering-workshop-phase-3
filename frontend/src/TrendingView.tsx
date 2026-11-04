import type { Stats } from "./api";

/** The memes people love most, best first (the order comes from the backend). */
export function TrendingView({ trending }: { trending: Stats["trending"] }) {
  if (trending.memes.length === 0) {
    return (
      <section className="trending-view">
        <h2>Trending</h2>
        <p>Nothing is trending yet. Memes show up here once a few people have swiped them.</p>
      </section>
    );
  }
  return (
    <section className="trending-view">
      <h2>Trending</h2>
      <p className="trending-period">
        {trending.period === "hour"
          ? "The most loved memes of the last hour"
          : "The most loved memes of all time (not enough swipes in the last hour yet)"}
      </p>
      <ol>
        {trending.memes.map(({ meme, percent, swipes }) => (
          <li key={meme.id}>
            <img src={meme.imageUrl} alt={meme.caption} />
            <div>
              <p className="trending-caption">{meme.caption}</p>
              <p className="trending-numbers">
                {percent}% loved this · {swipes} swipes
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
