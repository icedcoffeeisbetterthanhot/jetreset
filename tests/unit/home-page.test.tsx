import { render, screen } from "@testing-library/react";
import HomePage from "../../src/app/page";

describe("HomePage", () => {
  it("renders JetReset headline and description", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", {
        name: /Recover from jet lag with calm, practical guidance/i
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(/JetReset helps travellers recover from jet lag/i)
    ).toBeInTheDocument();
  });

  it("shows disabled preview button", () => {
    render(<HomePage />);

    const button = screen.getByRole("button", { name: /preview coming soon/i });
    expect(button).toBeDisabled();
  });
});
