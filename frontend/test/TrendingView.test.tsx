import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Stats } from "../src/api";
import { TrendingView } from "../src/TrendingView";

const meme = (id: string, caption: string) => ({
  id,
  caption,
  imageUrl: `/api/memes/images/${id}.svg`,
});

const hour: Stats["trending"] = {
  period: "hour",
  memes: [
    { meme: meme("a", "It Was DNS"), percent: 95, swipes: 20 },
    { meme: meme("b", "Friday deploy"), percent: 80, swipes: 5 },
    { meme: meme("c", "Works on my machine"), percent: 67, swipes: 3 },
  ],
};

describe("TrendingView", () => {
  it("lists the memes in the order given, with picture, percentage and swipes", () => {
    render(<TrendingView trending={hour} />);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(within(items[0]).getByRole("img", { name: "It Was DNS" })).toHaveAttribute(
      "src",
      "/api/memes/images/a.svg",
    );
    expect(items[0]).toHaveTextContent("It Was DNS");
    expect(items[0]).toHaveTextContent("95% loved this · 20 swipes");
    expect(items[2]).toHaveTextContent("67% loved this · 3 swipes");
  });

  it("says the numbers are from the last hour", () => {
    render(<TrendingView trending={hour} />);

    expect(screen.getByText("The most loved memes of the last hour")).toBeInTheDocument();
  });

  it("says when it has fallen back to all time", () => {
    render(<TrendingView trending={{ ...hour, period: "all-time" }} />);

    expect(screen.getByText(/of all time/)).toBeInTheDocument();
    expect(screen.getByText(/not enough swipes in the last hour/)).toBeInTheDocument();
    expect(screen.queryByText("The most loved memes of the last hour")).not.toBeInTheDocument();
  });

  it("explains that nothing is trending when there are no memes", () => {
    render(<TrendingView trending={{ period: "all-time", memes: [] }} />);

    expect(screen.getByText(/Nothing is trending yet/)).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
