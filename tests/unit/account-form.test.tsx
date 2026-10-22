import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AccountForm } from "@components/auth/AccountForm";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

describe("AccountForm", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("registers with a username and password without requiring email", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ guestTripCount: 0 }),
      }),
    );
    render(<AccountForm mode="register" />);

    fireEvent.change(screen.getByLabelText(/Username/), { target: { value: "testpilot" } });
    fireEvent.change(screen.getByLabelText(/Password/), {
      target: { value: "a-long-test-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create your account" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/auth/register",
        expect.objectContaining({
          body: JSON.stringify({ username: "testpilot", password: "a-long-test-password" }),
        }),
      ),
    );
  });
});
