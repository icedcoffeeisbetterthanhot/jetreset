import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AccountNavigation } from "@components/auth/AccountNavigation";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("AccountNavigation", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ signedIn: false }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows sign-in options for a guest inside the menu", async () => {
    render(<AccountNavigation />);

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/auth/session"));
    const accountButton = document.querySelector('summary[aria-label="Account menu"]');
    if (!accountButton) throw new Error("Account menu button was not rendered.");
    const menu = accountButton.closest("details");
    expect(menu).not.toHaveAttribute("open");
    expect(document.querySelector('a[href="/game"]')).not.toBeInTheDocument();

    fireEvent.click(accountButton);

    expect(menu).toHaveAttribute("open");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/account/sign-in",
    );
    expect(screen.getByRole("link", { name: "Create account" })).toHaveAttribute(
      "href",
      "/account/register",
    );
  });

  it("shows settings and sign-out, but no guest account links, for signed-in users", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ signedIn: true, username: "testpilot" }),
      }),
    );
    render(<AccountNavigation />);

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/auth/session"));
    const accountButton = document.querySelector('summary[aria-label="Account menu"]');
    if (!accountButton) throw new Error("Account menu button was not rendered.");
    fireEvent.click(accountButton);

    expect(screen.getByText("@testpilot")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Account settings" })).toHaveAttribute(
      "href",
      "/account/settings",
    );
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create account" })).not.toBeInTheDocument();
  });

  it("does not expose guest account actions while status is loading", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    render(<AccountNavigation />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading account…");
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create account" })).not.toBeInTheDocument();
  });
});
