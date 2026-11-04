import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Confetti } from "../src/Confetti";

afterEach(() => vi.unstubAllGlobals());

describe("Confetti", () => {
  it("renders the requested number of pieces, hidden from screen readers", () => {
    render(<Confetti pieces={12} />);

    const confetti = screen.getByTestId("confetti");
    expect(confetti).toHaveAttribute("aria-hidden", "true");
    expect(confetti.children).toHaveLength(12);
  });

  it("renders nothing when the user prefers reduced motion", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));

    render(<Confetti />);

    expect(screen.queryByTestId("confetti")).not.toBeInTheDocument();
  });
});
