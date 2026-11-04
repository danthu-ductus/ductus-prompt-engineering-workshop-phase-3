import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { App } from "../src/App";

const first = { id: "m1", caption: "It works on my machine", imageUrl: "/api/memes/images/m1.svg" };
const second = { id: "m2", caption: "Friday deploy", imageUrl: "/api/memes/images/m2.svg" };

const ok = (body: unknown) => ({ ok: true, json: async () => body });

const profile = { userId: "u1", nickname: "Giggly Penguin", emoji: "😎" };

/**
 * Installs fetchMock as fetch, except that the profile endpoint is answered separately. The
 * app loads the profile on start, and this keeps it out of the numbered calls the tests check.
 */
function stubFetch(
  fetchMock: Mock,
  profileHandler: (init?: RequestInit) => unknown = () => ok({ profile }),
) {
  vi.stubGlobal("fetch", (url: string, init?: RequestInit) =>
    url === "/api/profile" ? Promise.resolve(profileHandler(init)) : fetchMock(url, init),
  );
}

afterEach(() => vi.unstubAllGlobals());

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
