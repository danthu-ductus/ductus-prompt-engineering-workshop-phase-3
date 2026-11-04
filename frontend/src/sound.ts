/** C, E, G and a high C: a short, happy jingle. */
const NOTES_HZ = [523.25, 659.25, 783.99, 1046.5];

/** Plays the match jingle. Silent when the browser has no audio or blocks it. */
export function playMatchSound(): void {
  try {
    if (typeof window.AudioContext === "undefined") return;
    const context = new window.AudioContext();
    void context.resume();
    NOTES_HZ.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + index * 0.12;
      oscillator.type = "triangle";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.45);
    });
    window.setTimeout(() => void context.close(), 1500);
  } catch {
    // No sound is fine: the celebration still shows.
  }
}
