import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { App } from "../src/App";

const first = { id: "m1", caption: "It works on my machine", imageUrl: "/api/memes/images/m1.svg" };
const second = { id: "m2", caption: "Friday deploy", imageUrl: "/api/memes/images/m2.svg" };

const ok = (body: unknown) => ({ ok: true, json: async () => body });

const profile = { userId: "u1", nickname: "Giggly Penguin", emoji: "😎" };

const noStats = { memesPerMinute: 0, trending: { period: "all-time", memes: [] } };

/**
 * Installs fetchMock as fetch, except that the profile and stats endpoints are answered
 * separately. The app loads the profile on start and refreshes the stats on a timer, and this
 * keeps both out of the numbered calls the tests check.
 */
function stubFetch(
  fetchMock: Mock,
  profileHandler: (init?: RequestInit) => unknown = () => ok({ profile }),
  statsHandler: () => unknown = () => ok(noStats),
) {
  vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
    if (url === "/api/profile") return Promise.resolve(profileHandler(init));
    if (url === "/api/stats") return Promise.resolve(statsHandler());
    // No new matches, so the match check never takes a response meant for another request.
    if (url === "/api/matches/check") return Promise.resolve(ok({ matches: [] }));
    return fetchMock(url, init);
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

/** A fake backend that serves the given memes one after another and accepts every swipe. */
function fakeBackend(memes: { id: string; caption: string; imageUrl: string }[]) {
  let served = 0;
  const fetchMock = vi.fn(async (_url: string, init: RequestInit = {}) =>
    init.method === "POST" ? ok({}) : ok({ meme: memes[served++] ?? null }),
  );
  stubFetch(fetchMock);
  return fetchMock;
}

const manyMemes = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `m${i}`,
    caption: `Meme ${i}`,
    imageUrl: `/api/memes/images/m${i}.svg`,
  }));

describe("App", () => {
  it("shows the meme returned by the backend", async () => {
    stubFetch(vi.fn().mockResolvedValue(ok({ meme: first })));

    render(<App />);

    const image = await screen.findByRole("img", { name: first.caption });
    expect(image).toHaveAttribute("src", first.imageUrl);
  });

  it.each([
    ["Like", "like"],
    ["Nope", "nope"],
  ])("sends a %s swipe and shows the next meme", async (label, direction) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ meme: first }))
      .mockResolvedValueOnce(ok({ memeId: first.id, direction }))
      .mockResolvedValueOnce(ok({ meme: second }));
    stubFetch(fetchMock);
    render(<App />);
    await screen.findByRole("img", { name: first.caption });

    fireEvent.click(screen.getByRole("button", { name: label }));

    expect(await screen.findByRole("img", { name: second.caption })).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/swipes");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ memeId: first.id, direction });
    expect(init.headers["X-User-Id"]).toEqual(expect.any(String));
  });

  it("swipes with the arrow keys in the swipe view but not in the likes view", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ meme: first }))
      .mockResolvedValueOnce(ok({ memeId: first.id, direction: "like" }))
      .mockResolvedValueOnce(ok({ meme: second }))
      .mockResolvedValueOnce(ok({ memes: [] }));
    stubFetch(fetchMock);
    render(<App />);
    await screen.findByRole("img", { name: first.caption });

    fireEvent.keyDown(window, { key: "ArrowRight" });
    await screen.findByRole("img", { name: second.caption });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      memeId: first.id,
      direction: "like",
    });

    fireEvent.click(screen.getByRole("button", { name: "Likes" }));
    await screen.findByText("You have not liked any memes yet.");
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("sends only one swipe while a swipe request is in flight", async () => {
    let finish: (value: unknown) => void = () => {};
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ meme: first }))
      .mockReturnValueOnce(new Promise((resolve) => (finish = resolve)))
      .mockResolvedValueOnce(ok({ meme: second }));
    stubFetch(fetchMock);
    render(<App />);
    await screen.findByRole("img", { name: first.caption });

    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    finish(ok({ memeId: first.id, direction: "like" }));

    await screen.findByRole("img", { name: second.caption });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("shows the empty state with a Reset button when there are no more memes", async () => {
    stubFetch(vi.fn().mockResolvedValue(ok({ meme: null })));

    render(<App />);

    expect(await screen.findByText("You have seen all memes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Like" })).not.toBeInTheDocument();
  });

  it("resets the swipe history and shows a meme again when Reset is clicked", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ meme: null }))
      .mockResolvedValueOnce({ ok: true, status: 204 })
      .mockResolvedValueOnce(ok({ meme: first }));
    stubFetch(fetchMock);
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Reset" }));

    expect(await screen.findByRole("img", { name: first.caption })).toBeInTheDocument();
    expect(screen.queryByText("You have seen all memes")).not.toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/swipes");
    expect(init.method).toBe("DELETE");
    expect(init.headers["X-User-Id"]).toEqual(expect.any(String));
  });

  it("shows an error message when the reset fails", async () => {
    stubFetch(
      vi
        .fn()
        .mockResolvedValueOnce(ok({ meme: null }))
        .mockResolvedValueOnce({ ok: false, status: 500 }),
    );
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Reset" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
  });

  it("shows an error message when the backend fails", async () => {
    stubFetch(vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
  });

  it("shows an error message when the backend is unreachable", async () => {
    stubFetch(vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to fetch");
  });

  it("shows an error message when recording a swipe fails", async () => {
    stubFetch(
      vi
        .fn()
        .mockResolvedValueOnce(ok({ meme: first }))
        .mockResolvedValueOnce({ ok: false, status: 500 }),
    );
    render(<App />);
    await screen.findByRole("img", { name: first.caption });

    fireEvent.click(screen.getByRole("button", { name: "Like" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  describe("celebrations", () => {
    async function swipeAll(memes: { caption: string }[], labels: string[]) {
      for (const [i, label] of labels.entries()) {
        fireEvent.click(screen.getByRole("button", { name: label }));
        await screen.findByRole("img", { name: memes[i + 1].caption });
      }
    }

    it("throws confetti after five likes in a row, not before", async () => {
      const memes = manyMemes(6);
      fakeBackend(memes);
      render(<App />);
      await screen.findByRole("img", { name: memes[0].caption });

      await swipeAll(memes, ["Like", "Like", "Like", "Like"]);
      expect(screen.queryByTestId("confetti")).not.toBeInTheDocument();

      await swipeAll(memes.slice(4), ["Like"]);
      expect(screen.getByTestId("confetti")).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("5 likes in a row");
    });

    it("starts the streak over after a nope", async () => {
      const memes = manyMemes(7);
      fakeBackend(memes);
      render(<App />);
      await screen.findByRole("img", { name: memes[0].caption });

      await swipeAll(memes, ["Like", "Like", "Like", "Like", "Nope", "Like"]);

      expect(screen.queryByTestId("confetti")).not.toBeInTheDocument();
    });

    it("celebrates the 100th swipe ever in this browser, even after a reset", async () => {
      // 99 swipes were made earlier, for example before a Reset.
      localStorage.setItem("meme-tinder-swipe-count", "99");
      const memes = manyMemes(2);
      fakeBackend(memes);
      render(<App />);
      await screen.findByRole("img", { name: memes[0].caption });

      await swipeAll(memes, ["Nope"]);

      expect(screen.getByRole("status")).toHaveTextContent("100 memes swiped");
      expect(screen.getByTestId("confetti")).toBeInTheDocument();
    });

    it("keeps the message but drops the confetti when motion is reduced", async () => {
      vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
      const memes = manyMemes(6);
      fakeBackend(memes);
      render(<App />);
      await screen.findByRole("img", { name: memes[0].caption });

      await swipeAll(memes, ["Like", "Like", "Like", "Like", "Like"]);

      expect(screen.getByRole("status")).toHaveTextContent("5 likes in a row");
      expect(screen.queryByTestId("confetti")).not.toBeInTheDocument();
    });
  });

  it("brings the card back when a swipe fails", async () => {
    stubFetch(
      vi
        .fn()
        .mockResolvedValueOnce(ok({ meme: first }))
        .mockResolvedValueOnce({ ok: false, status: 500 }),
    );
    render(<App />);
    await screen.findByRole("img", { name: first.caption });

    fireEvent.click(screen.getByRole("button", { name: "Like" }));

    await screen.findByRole("alert");
    const card = screen.getByRole("img", { name: first.caption }).closest("figure");
    expect(card).not.toHaveClass("leaving");
  });

  describe("Hot or Not", () => {
    const trendingStats = {
      memesPerMinute: 7,
      trending: {
        period: "hour",
        memes: [
          { meme: second, percent: 92, swipes: 13 },
          { meme: first, percent: 60, swipes: 5 },
        ],
      },
    };

    afterEach(() => vi.useRealTimers());

    it("shows how many people loved the meme on the card", async () => {
      stubFetch(
        vi.fn().mockResolvedValue(ok({ meme: { ...first, love: { percent: 87, swipes: 23 } } })),
      );

      render(<App />);

      expect(await screen.findByText("87% loved this")).toBeInTheDocument();
    });

    it("invites the first swipe on a meme nobody has swiped", async () => {
      stubFetch(
        vi.fn().mockResolvedValue(ok({ meme: { ...first, love: { percent: null, swipes: 0 } } })),
      );

      render(<App />);

      expect(await screen.findByText("Be the first to swipe")).toBeInTheDocument();
    });

    it("shows how many people loved each liked meme", async () => {
      stubFetch(
        vi
          .fn()
          .mockResolvedValueOnce(ok({ meme: first }))
          .mockResolvedValueOnce(ok({ memes: [{ ...first, love: { percent: 75, swipes: 4 } }] })),
      );
      render(<App />);
      await screen.findByRole("img", { name: first.caption });

      fireEvent.click(screen.getByRole("button", { name: "Likes" }));

      expect(await screen.findByText("75% loved this")).toBeInTheDocument();
    });

    it("shows the memes per minute of everyone", async () => {
      stubFetch(vi.fn().mockResolvedValue(ok({ meme: first })), undefined, () => ok(trendingStats));

      render(<App />);

      expect(await screen.findByText(/7 memes\/min/)).toBeInTheDocument();
    });

    it("refreshes memes per minute every few seconds", async () => {
      vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
      let current = 3;
      stubFetch(vi.fn().mockResolvedValue(ok({ meme: first })), undefined, () =>
        ok({ ...noStats, memesPerMinute: current }),
      );
      render(<App />);
      expect(await screen.findByText(/3 memes\/min/)).toBeInTheDocument();

      current = 12;
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      expect(await screen.findByText(/12 memes\/min/)).toBeInTheDocument();
    });

    it("lists the trending memes, best first, on the Trending tab", async () => {
      stubFetch(vi.fn().mockResolvedValue(ok({ meme: first })), undefined, () => ok(trendingStats));
      render(<App />);
      await screen.findByRole("img", { name: first.caption });

      fireEvent.click(screen.getByRole("button", { name: "Trending" }));

      expect(await screen.findByRole("heading", { name: "Trending" })).toBeInTheDocument();
      expect(screen.getByText("The most loved memes of the last hour")).toBeInTheDocument();
      const items = screen.getAllByRole("listitem");
      expect(items[0]).toHaveTextContent("Friday deploy");
      expect(items[0]).toHaveTextContent("92% loved this · 13 swipes");
      expect(items[1]).toHaveTextContent("It works on my machine");
      expect(screen.queryByRole("button", { name: "Like" })).not.toBeInTheDocument();
    });

    it("keeps the app working when the numbers cannot be loaded", async () => {
      stubFetch(vi.fn().mockResolvedValue(ok({ meme: first })), undefined, () => ({
        ok: false,
        status: 500,
      }));

      render(<App />);

      expect(await screen.findByRole("img", { name: first.caption })).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.queryByText(/memes\/min/)).not.toBeInTheDocument();
    });
  });

  describe("likes view", () => {
    it("lists the liked memes when the Likes button is clicked", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(ok({ meme: first }))
        .mockResolvedValueOnce(ok({ memes: [first, second] }));
      stubFetch(fetchMock);
      render(<App />);
      await screen.findByRole("img", { name: first.caption });

      fireEvent.click(screen.getByRole("button", { name: "Likes" }));

      expect(await screen.findByRole("heading", { name: "Your likes" })).toBeInTheDocument();
      expect(screen.getByRole("img", { name: first.caption })).toHaveAttribute(
        "src",
        first.imageUrl,
      );
      expect(screen.getByRole("img", { name: second.caption })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Like" })).not.toBeInTheDocument();
      expect(fetchMock.mock.calls[1][0]).toBe("/api/likes");
      expect(fetchMock.mock.calls[1][1].headers["X-User-Id"]).toEqual(expect.any(String));
    });

    it("shows an empty message when nothing is liked", async () => {
      stubFetch(
        vi
          .fn()
          .mockResolvedValueOnce(ok({ meme: first }))
          .mockResolvedValueOnce(ok({ memes: [] })),
      );
      render(<App />);
      await screen.findByRole("img", { name: first.caption });

      fireEvent.click(screen.getByRole("button", { name: "Likes" }));

      expect(await screen.findByText("You have not liked any memes yet.")).toBeInTheDocument();
    });

    it("navigates back to the swipe view", async () => {
      stubFetch(
        vi
          .fn()
          .mockResolvedValueOnce(ok({ meme: first }))
          .mockResolvedValueOnce(ok({ memes: [] }))
          .mockResolvedValueOnce(ok({ meme: first })),
      );
      render(<App />);
      await screen.findByRole("img", { name: first.caption });
      fireEvent.click(screen.getByRole("button", { name: "Likes" }));
      await screen.findByText("You have not liked any memes yet.");

      fireEvent.click(screen.getByRole("button", { name: "Swipe" }));

      expect(await screen.findByRole("img", { name: first.caption })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Like" })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Your likes" })).not.toBeInTheDocument();
    });

    it("shows an error message when loading likes fails", async () => {
      stubFetch(
        vi
          .fn()
          .mockResolvedValueOnce(ok({ meme: first }))
          .mockResolvedValueOnce({ ok: false, status: 500 }),
      );
      render(<App />);
      await screen.findByRole("img", { name: first.caption });

      fireEvent.click(screen.getByRole("button", { name: "Likes" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
      expect(screen.queryByText("You have not liked any memes yet.")).not.toBeInTheDocument();
    });
  });

  describe("profile", () => {
    const memeMock = () => vi.fn().mockResolvedValue(ok({ meme: first }));

    it("shows the nickname and emoji in the header", async () => {
      stubFetch(memeMock());

      render(<App />);

      expect(await screen.findByLabelText("Signed in as")).toHaveTextContent("😎 Giggly Penguin");
    });

    it("keeps working without a profile when the profile request fails", async () => {
      stubFetch(memeMock(), () => ({ ok: false, status: 500 }));

      render(<App />);

      expect(await screen.findByRole("img", { name: first.caption })).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Signed in as")).not.toBeInTheDocument();
    });

    it("asks for the profile again when the Profile view is opened without one", async () => {
      const profileHandler = vi
        .fn()
        .mockReturnValueOnce({ ok: false, status: 500 })
        .mockReturnValue(ok({ profile }));
      stubFetch(memeMock(), profileHandler);
      render(<App />);
      await screen.findByRole("img", { name: first.caption });

      fireEvent.click(screen.getByRole("button", { name: "Profile" }));

      expect(await screen.findByRole("heading", { name: "Your profile" })).toBeInTheDocument();
      expect(screen.getByLabelText("Nickname")).toHaveValue("Giggly Penguin");
    });

    it("saves a new nickname and emoji and updates the header", async () => {
      const saved = { userId: "u1", nickname: "Sara", emoji: "🦄" };
      const profileHandler = vi.fn((init?: RequestInit) =>
        init?.method === "PUT" ? ok({ profile: saved }) : ok({ profile }),
      );
      stubFetch(memeMock(), profileHandler);
      render(<App />);
      await screen.findByRole("img", { name: first.caption });
      fireEvent.click(screen.getByRole("button", { name: "Profile" }));
      await screen.findByRole("heading", { name: "Your profile" });

      fireEvent.change(screen.getByLabelText("Nickname"), { target: { value: "Sara" } });
      fireEvent.click(screen.getByRole("button", { name: "🦄" }));
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(await screen.findByRole("status")).toHaveTextContent("Saved");
      expect(screen.getByLabelText("Signed in as")).toHaveTextContent("🦄 Sara");
      const put = profileHandler.mock.calls.map(([init]) => init).find((i) => i?.method === "PUT");
      expect(JSON.parse(String(put?.body))).toEqual({ nickname: "Sara", emoji: "🦄" });
      expect(put?.headers).toMatchObject({ "X-User-Id": expect.any(String) });
    });

    it("shows the message from the API when saving is rejected", async () => {
      const profileHandler = (init?: RequestInit) =>
        init?.method === "PUT"
          ? {
              ok: false,
              status: 400,
              json: async () => ({ error: "emoji must be a single emoji" }),
            }
          : ok({ profile });
      stubFetch(memeMock(), profileHandler);
      render(<App />);
      await screen.findByRole("img", { name: first.caption });
      fireEvent.click(screen.getByRole("button", { name: "Profile" }));
      await screen.findByRole("heading", { name: "Your profile" });

      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Could not save: emoji must be a single emoji",
      );
      expect(screen.getByLabelText("Signed in as")).toHaveTextContent("😎 Giggly Penguin");
    });

    it("navigates back to the swipe view", async () => {
      stubFetch(memeMock());
      render(<App />);
      await screen.findByRole("img", { name: first.caption });
      fireEvent.click(screen.getByRole("button", { name: "Profile" }));
      await screen.findByRole("heading", { name: "Your profile" });

      fireEvent.click(screen.getByRole("button", { name: "Swipe" }));

      expect(await screen.findByRole("img", { name: first.caption })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Your profile" })).not.toBeInTheDocument();
    });

    it("does not swipe with the arrow keys in the profile view", async () => {
      const fetchMock = memeMock();
      stubFetch(fetchMock);
      render(<App />);
      await screen.findByRole("img", { name: first.caption });
      fireEvent.click(screen.getByRole("button", { name: "Profile" }));
      await screen.findByRole("heading", { name: "Your profile" });

      fireEvent.keyDown(window, { key: "ArrowRight" });

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
