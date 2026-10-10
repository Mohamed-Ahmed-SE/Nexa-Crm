import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UserAvatar } from "@/components/shell/user-avatar";

describe("UserAvatar", () => {
  it("shows initials when no avatar URL is set", () => {
    render(<UserAvatar avatarUrl={null} fullName="Alex Chen" />);
    expect(screen.getByText("AC")).toBeInTheDocument();
  });

  it("falls back to initials when the avatar cannot load", () => {
    const { container } = render(<UserAvatar avatarUrl="https://images.example.com/alex.png" fullName="Alex Chen" />);
    const image = container.querySelector("img");
    expect(image).not.toBeNull();
    fireEvent.error(image!);
    expect(screen.getByText("AC")).toBeInTheDocument();
  });

  it.each(["http://images.example.com/alex.png", "javascript:alert(1)"])("uses initials for unsafe stored avatar URL %s", (avatarUrl) => {
    render(<UserAvatar avatarUrl={avatarUrl} fullName="Alex Chen" />);
    expect(screen.getByText("AC")).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });
});
