import { useCallback, useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCreateIntent } from "./use-create-intent";

const { router, replace } = vi.hoisted(() => {
  const replace = vi.fn();
  return { router: { replace }, replace };
});
vi.mock("next/navigation", () => ({ useRouter: () => router }));

function CreateFormHarness({ createIntent, canCreate }: { createIntent: boolean; canCreate: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const openCreateForm = useCallback(() => setIsOpen(true), []);
  useCreateIntent(createIntent, canCreate, openCreateForm);
  return isOpen ? <div aria-label="Create form" role="dialog">New record form</div> : null;
}

describe("useCreateIntent", () => {
  beforeEach(() => {
    replace.mockClear();
    window.history.replaceState({}, "", "/app/leads?create=1&origin=global-search");
  });

  it("opens a mounted create form when the authorized intent changes to true", async () => {
    const { rerender } = render(<CreateFormHarness canCreate createIntent={false} />);
    expect(screen.queryByRole("dialog", { name: "Create form" })).not.toBeInTheDocument();

    rerender(<CreateFormHarness canCreate createIntent />);

    expect(await screen.findByRole("dialog", { name: "Create form" })).toBeInTheDocument();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/app/leads?origin=global-search", { scroll: false }));
    rerender(<CreateFormHarness canCreate createIntent={false} />);
    expect(screen.getByRole("dialog", { name: "Create form" })).toBeInTheDocument();
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("does not open or consume the intent without create permission", () => {
    const { rerender } = render(<CreateFormHarness canCreate={false} createIntent={false} />);
    rerender(<CreateFormHarness canCreate={false} createIntent />);

    expect(screen.queryByRole("dialog", { name: "Create form" })).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
