import type { Person } from "./api";

function DemoBadge() {
  return (
    <span className="demo-badge" title="A demo profile, not a real person">
      demo
    </span>
  );
}

function Compatibility({ person }: { person: Person }) {
  if (person.score !== null) {
    return (
      <p className="score">
        You and {person.nickname} are {person.score}% compatible!
      </p>
    );
  }
  const memes = person.memesNeeded === 1 ? "meme" : "memes";
  return (
    <p className="progress">
      Swipe {person.memesNeeded} more {memes} in common to see your score
    </p>
  );
}

/** The other users, best match first (the order comes from the backend). */
export function PeopleView({ people }: { people: Person[] }) {
  if (people.length === 0) {
    return (
      <section className="people-view">
        <h2>People like you</h2>
        <p>Nobody else is here yet.</p>
      </section>
    );
  }
  return (
    <section className="people-view">
      <h2>People like you</h2>
      <ul>
        {people.map((person) => (
          <li key={person.id}>
            <span className="person-name">
              <span aria-hidden="true">{person.emoji}</span> {person.nickname}
              {person.demo && <DemoBadge />}
            </span>
            <Compatibility person={person} />
          </li>
        ))}
      </ul>
    </section>
  );
}
