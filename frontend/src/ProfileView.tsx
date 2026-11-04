import { useState, type FormEvent } from "react";
import type { Profile } from "./api";

const NICKNAME_MAX_LENGTH = 30;

const EMOJI_CHOICES = [
  "😎",
  "🐸",
  "🦄",
  "🐙",
  "🦊",
  "🐼",
  "🤖",
  "👽",
  "🐧",
  "🦖",
  "😂",
  "🔥",
  "💀",
  "🥳",
  "🤡",
  "🧠",
];

interface ProfileViewProps {
  profile: Profile;
  /** Rejects with a readable message when the nickname or emoji is invalid. */
  onSave: (nickname: string, emoji: string) => Promise<void>;
}

type Status = { kind: "saved" } | { kind: "error"; message: string } | null;

export function ProfileView({ profile, onSave }: ProfileViewProps) {
  const [nickname, setNickname] = useState(profile.nickname);
  const [emoji, setEmoji] = useState(profile.emoji);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  // A profile may have an emoji that is not in the list, so keep it selectable.
  const choices = EMOJI_CHOICES.includes(emoji) ? EMOJI_CHOICES : [emoji, ...EMOJI_CHOICES];

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      await onSave(nickname, emoji);
      setStatus({ kind: "saved" });
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="profile-view">
      <h2>Your profile</h2>
      <form onSubmit={submit}>
        <label>
          Nickname
          <input
            type="text"
            value={nickname}
            maxLength={NICKNAME_MAX_LENGTH}
            onChange={(event) => setNickname(event.target.value)}
          />
        </label>
        <fieldset>
          <legend>Emoji</legend>
          <div className="emoji-choices">
            {choices.map((choice) => (
              <button
                key={choice}
                type="button"
                aria-pressed={choice === emoji}
                onClick={() => setEmoji(choice)}
              >
                {choice}
              </button>
            ))}
          </div>
        </fieldset>
        <button type="submit" className="save" disabled={saving || nickname.trim() === ""}>
          Save
        </button>
        {status?.kind === "saved" && <p role="status">Saved</p>}
        {status?.kind === "error" && <p role="alert">Could not save: {status.message}</p>}
      </form>
    </section>
  );
}
