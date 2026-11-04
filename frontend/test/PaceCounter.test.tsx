import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoveBadge } from "../src/LoveBadge";
import { PaceCounter } from "../src/PaceCounter";

describe("PaceCounter", () => {
  it("shows the number of memes per minute", () => {
    render(<PaceCounter memesPerMinute={42} />);

    expect(screen.getByText(/42 memes\/min/)).toBeInTheDocument();
  });

  it("shows zero too", () => {
    render(<PaceCounter memesPerMinute={0} />);

    expect(screen.getByText(/0 memes\/min/)).toBeInTheDocument();
  });
});

describe("LoveBadge", () => {
  it("shows the percentage", () => {
    render(<LoveBadge love={{ percent: 87, swipes: 10 }} />);

    expect(screen.getByText("87% loved this")).toBeInTheDocument();
  });

  it("shows 0% as a number, not as nothing", () => {
    render(<LoveBadge love={{ percent: 0, swipes: 4 }} />);

    expect(screen.getByText("0% loved this")).toBeInTheDocument();
  });

  it("invites the first swipe when there are no swipes", () => {
    render(<LoveBadge love={{ percent: null, swipes: 0 }} />);

    expect(screen.getByText("Be the first to swipe")).toBeInTheDocument();
  });

  it("shows nothing without the numbers", () => {
    const { container } = render(<LoveBadge />);

    expect(container).toBeEmptyDOMElement();
  });
});
