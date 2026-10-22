import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import PlaneGame from "../../src/components/game/PlaneGame";

describe("PlaneGame", () => {
  it("starts a flight and supports keyboard and touch steering", () => {
    render(<PlaneGame />);

    expect(screen.getByRole("status")).toHaveTextContent(/Ready for takeoff/);
    expect(screen.getByRole("button", { name: "Steer left" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Start flight" }));
    expect(screen.getByRole("status")).toHaveTextContent(/In flight/);
    expect(screen.getByRole("img", { name: /Plane in lane 4 of 7/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pause|resume/i })).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByRole("img", { name: /Plane in lane 3 of 7/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Steer right" }));
    expect(screen.getByRole("img", { name: /Plane in lane 4 of 7/ })).toBeInTheDocument();
  });

  it("ends a flight after a collision and restarts without keeping the previous score", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    render(<PlaneGame />);
    fireEvent.click(screen.getByRole("button", { name: "Start flight" }));
    act(() => {
      vi.advanceTimersByTime(11 * 700);
    });

    expect(screen.getByRole("status")).toHaveTextContent(/Flight over/i);
    expect(screen.getByRole("img", { name: /Game over/ })).toBeInTheDocument();
    expect(screen.getByText(/Flight over!/i)).toBeInTheDocument();
    expect(screen.getByText("0", { selector: "p" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fly again" }));
    expect(screen.getByRole("status")).toHaveTextContent(/In flight/);
    expect(screen.getByText("0", { selector: "p" })).toBeInTheDocument();

    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("counts clouds that pass the plane without saving the score", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);

    render(<PlaneGame />);
    fireEvent.click(screen.getByRole("button", { name: "Start flight" }));

    act(() => {
      vi.advanceTimersByTime(10 * 700);
    });

    expect(Number(screen.getByText(/^\d+$/, { selector: "p" }).textContent)).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /pause|resume/i })).not.toBeInTheDocument();

    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("uses multiple obstacle types and moves them faster as the flight progresses", () => {
    vi.useFakeTimers();
    const random = vi.spyOn(Math, "random");
    random.mockReturnValueOnce(0).mockReturnValueOnce(0);
    random.mockReturnValueOnce(0.2).mockReturnValueOnce(0.4);
    random.mockReturnValueOnce(0.4).mockReturnValueOnce(0.8);
    random.mockReturnValue(0);

    render(<PlaneGame />);
    fireEvent.click(screen.getByRole("button", { name: "Start flight" }));
    const flightPath = screen.getByRole("img", { name: /Flight path/ });

    act(() => {
      vi.advanceTimersByTime(8 * 700);
    });

    expect(flightPath).toHaveAccessibleName(/Obstacles approaching: white cloud, bird, balloon/);
    expect(flightPath).toHaveAttribute("data-speed", "2");

    act(() => {
      vi.advanceTimersByTime(8 * 700);
    });

    expect(flightPath).toHaveAttribute("data-speed", "3");
    expect(screen.getByText("Flight pace: 3x")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(16 * 700);
    });

    expect(flightPath).toHaveAttribute("data-speed", "5");
    expect(screen.getByText("Flight pace: 5x")).toBeInTheDocument();

    vi.useRealTimers();
    vi.restoreAllMocks();
  });
});
