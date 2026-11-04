import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SWIPE_THRESHOLD, MemeCard } from "../src/MemeCard";

const meme = { id: "m1", caption: "It works on my machine", imageUrl: "/api/memes/images/m1.svg" };

function setup(disabled = false) {
  const onSwipe = vi.fn();
  render(<MemeCard meme={meme} onSwipe={onSwipe} disabled={disabled} />);
  return { onSwipe, card: screen.getByRole("img", { name: meme.caption }).closest("figure")! };
}

function drag(card: HTMLElement, distance: number) {
  fireEvent.pointerDown(card, { clientX: 200, pointerId: 1 });
  fireEvent.pointerMove(card, { clientX: 200 + distance, pointerId: 1 });
  fireEvent.pointerUp(card, { clientX: 200 + distance, pointerId: 1 });
}

describe("MemeCard", () => {
  it("shows the meme image with the caption as alt text", () => {
    setup();

    expect(screen.getByRole("img", { name: meme.caption })).toHaveAttribute("src", meme.imageUrl);
  });

  it.each([
    ["Like", "like"],
    ["Nope", "nope"],
  ])("calls onSwipe with %s when its button is clicked", (label, direction) => {
    const { onSwipe } = setup();

    fireEvent.click(screen.getByRole("button", { name: label }));

    expect(onSwipe).toHaveBeenCalledExactlyOnceWith(direction);
  });

  it.each([
    ["ArrowRight", "like"],
    ["ArrowLeft", "nope"],
  ])("calls onSwipe when %s is pressed", (key, direction) => {
    const { onSwipe } = setup();

    fireEvent.keyDown(window, { key });

    expect(onSwipe).toHaveBeenCalledExactlyOnceWith(direction);
  });

  it("ignores other keys", () => {
    const { onSwipe } = setup();

    fireEvent.keyDown(window, { key: "ArrowUp" });

    expect(onSwipe).not.toHaveBeenCalled();
  });

  it.each([
    [SWIPE_THRESHOLD, "like"],
    [-SWIPE_THRESHOLD, "nope"],
  ])("calls onSwipe when dragged %ipx", (distance, direction) => {
    const { onSwipe, card } = setup();

    drag(card, distance);

    expect(onSwipe).toHaveBeenCalledExactlyOnceWith(direction);
  });

  it("follows the pointer while dragging and snaps back when released before the threshold", () => {
    const { onSwipe, card } = setup();

    fireEvent.pointerDown(card, { clientX: 200, pointerId: 1 });
    fireEvent.pointerMove(card, { clientX: 250, pointerId: 1 });
    expect(card.style.transform).toContain("translateX(50px)");
    fireEvent.pointerUp(card, { clientX: 250, pointerId: 1 });

    expect(onSwipe).not.toHaveBeenCalled();
    expect(card.style.transform).toContain("translateX(0px)");
  });

  describe("stamps", () => {
    const opacity = (text: string) => screen.getByText(text).style.opacity;

    it("shows no stamp at rest", () => {
      setup();

      expect(opacity("LIKE")).toBe("0");
      expect(opacity("NOPE")).toBe("0");
    });

    it.each([
      [SWIPE_THRESHOLD / 2, "LIKE", "NOPE"],
      [-SWIPE_THRESHOLD / 2, "NOPE", "LIKE"],
    ])("fades in with the drag distance (%ipx shows %s)", (distance, shown, hidden) => {
      const { card } = setup();

      fireEvent.pointerDown(card, { clientX: 200, pointerId: 1 });
      fireEvent.pointerMove(card, { clientX: 200 + distance, pointerId: 1 });

      expect(opacity(shown)).toBe("0.5");
      expect(opacity(hidden)).toBe("0");

      fireEvent.pointerMove(card, { clientX: 200 + distance * 4, pointerId: 1 });
      expect(opacity(shown)).toBe("1");
    });

    it("tints the card in the color of the drag direction", () => {
      const { card } = setup();

      fireEvent.pointerDown(card, { clientX: 200, pointerId: 1 });
      fireEvent.pointerMove(card, { clientX: 200 + SWIPE_THRESHOLD / 2, pointerId: 1 });

      expect((card.querySelector(".tint-like") as HTMLElement).style.opacity).toBe("0.5");
      expect((card.querySelector(".tint-nope") as HTMLElement).style.opacity).toBe("0");
    });

    it("goes away again when a short drag snaps back", () => {
      const { card } = setup();

      fireEvent.pointerDown(card, { clientX: 200, pointerId: 1 });
      fireEvent.pointerMove(card, { clientX: 250, pointerId: 1 });
      fireEvent.pointerUp(card, { clientX: 250, pointerId: 1 });

      expect(opacity("LIKE")).toBe("0");
    });

    it.each([
      ["button", "Like", "LIKE", "translateX(150%)"],
      ["button", "Nope", "NOPE", "translateX(-150%)"],
      ["key", "ArrowRight", "LIKE", "translateX(150%)"],
      ["key", "ArrowLeft", "NOPE", "translateX(-150%)"],
    ])("shows the full stamp and flies off after a %s swipe (%s)", (via, input, stamp, flyOff) => {
      const { card } = setup();

      if (via === "button") fireEvent.click(screen.getByRole("button", { name: input }));
      else fireEvent.keyDown(window, { key: input });

      expect(opacity(stamp)).toBe("1");
      expect(card).toHaveClass("leaving");
      expect(card.style.transform).toContain(flyOff);
    });

    it("flies off in the drag direction after a drag swipe", () => {
      const { card } = setup();

      drag(card, -SWIPE_THRESHOLD);

      expect(opacity("NOPE")).toBe("1");
      expect(card).toHaveClass("leaving");
    });
  });

  it("does nothing when disabled", () => {
    const { onSwipe, card } = setup(true);

    drag(card, SWIPE_THRESHOLD * 2);
    fireEvent.keyDown(window, { key: "ArrowRight" });

    expect(onSwipe).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Like" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Nope" })).toBeDisabled();
  });
});
