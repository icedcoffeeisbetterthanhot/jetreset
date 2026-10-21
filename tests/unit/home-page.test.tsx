import React from "react";
import { render, screen } from "@testing-library/react";
import HomePage from "../../src/app/page";

describe("HomePage", () => {
  it("renders JetReset headline and description", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", {
        name: /Recover from jet lag with calm, practical guidance/i,
      }),
    ).toBeInTheDocument();

    expect(screen.getByText(/JetReset helps travellers recover from jet lag/i)).toBeInTheDocument();
  });

  it("provides navigation to trip management", () => {
    render(<HomePage />);

    expect(screen.getByRole("link", { name: /manage trips/i })).toHaveAttribute("href", "/trips");
  });
});
