import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProfileView } from "../src/ProfileView";

const profile = { userId: "u1", nickname: "Giggly Penguin", emoji: "😎" };

describe("ProfileView", () => {
  it("shows the current nickname and marks the current emoji", () => {
    render(<ProfileView profile={profile} onSave={vi.fn()} />);

    expect(screen.getByLabelText("Nickname")).toHaveValue("Giggly Penguin");
    expect(screen.getByRole("button", { name: "😎" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "🦄" })).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps an emoji that is not in the list selectable", () => {
    render(<ProfileView profile={{ ...profile, emoji: "🍕" }} onSave={vi.fn()} />);

    expect(screen.getByRole("button", { name: "🍕" })).toHaveAttribute("aria-pressed", "true");
  });

  it("saves the edited nickname and the chosen emoji", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<ProfileView profile={profile} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText("Nickname"), { target: { value: "Sara" } });
    fireEvent.click(screen.getByRole("button", { name: "🦄" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Saved");
    expect(onSave).toHaveBeenCalledWith("Sara", "🦄");
    expect(screen.getByRole("button", { name: "🦄" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "😎" })).toHaveAttribute("aria-pressed", "false");
  });

  it("cannot save an empty nickname", () => {
    render(<ProfileView profile={profile} onSave={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Nickname"), { target: { value: "   " } });

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("limits the nickname length", () => {
    render(<ProfileView profile={profile} onSave={vi.fn()} />);

    expect(screen.getByLabelText("Nickname")).toHaveAttribute("maxlength", "30");
  });

  it("shows the reason when saving fails and allows another try", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("nickname is required"));
    render(<ProfileView profile={profile} onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not save: nickname is required",
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });
});
