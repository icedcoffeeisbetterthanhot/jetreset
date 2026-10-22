import React from "react";
import { render, screen } from "@testing-library/react";
import HomePage from "../../src/app/page";

describe("HomePage", () => {
  it("welcomes travellers and explains the trip and recovery features", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", {
        name: /Make your next time-zone change a little easier/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Plan your journey/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Organize your flights/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Ease into local time/i })).toBeInTheDocument();
    expect(screen.getByText(/live flight tracking .*not available/i)).toBeInTheDocument();
  });

  it("provides clear links to create and manage trips", () => {
    render(<HomePage />);

    expect(screen.getByRole("link", { name: /plan your first trip/i })).toHaveAttribute(
      "href",
      "/trips/new",
    );
    expect(screen.getByRole("link", { name: /view my trips/i })).toHaveAttribute("href", "/trips");
  });
});
