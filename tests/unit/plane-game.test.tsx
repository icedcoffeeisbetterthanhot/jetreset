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
    fireEvent.click(screen.getByRole("button", { name: "Restart from level 1" }));
    expect(screen.getByRole("status")).toHaveTextContent(/In flight/);
    expect(screen.getByText("0", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Plane in lane 4 of 7/ })).toHaveAttribute(
      "data-level",
      "1",
    );

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

  it("increases pace gradually, adds obstacles, and keeps them moving one row at a time", () => {
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
    expect(flightPath).toHaveAttribute("data-speed", "1");
    expect(
      Math.max(
        ...Array.from(flightPath.querySelectorAll("[data-obstacle-row]")).map((cell) =>
          Number(cell.getAttribute("data-obstacle-row")),
        ),
      ),
    ).toBe(7);

    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(
      Math.max(
        ...Array.from(flightPath.querySelectorAll("[data-obstacle-row]")).map((cell) =>
          Number(cell.getAttribute("data-obstacle-row")),
        ),
      ),
    ).toBe(8);

    act(() => {
      vi.advanceTimersByTime(21 * 700);
    });

    expect(screen.getByRole("button", { name: "Launch level 2" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Launch level 2" }));
    const spaceFlightPath = screen.getByRole("img", { name: /Space flight/ });

    act(() => {
      vi.advanceTimersByTime(12 * 700);
    });

    expect(spaceFlightPath).toHaveAttribute("data-speed", "2");

    act(() => {
      vi.advanceTimersByTime(12 * 700);
    });

    expect(spaceFlightPath).toHaveAttribute("data-speed", "3");
    expect(screen.getByText("Flight pace: 3x")).toBeInTheDocument();
    expect(spaceFlightPath.querySelectorAll("[data-obstacle-type]").length).toBeGreaterThan(1);

    act(() => {
      vi.advanceTimersByTime(16 * 700);
    });

    expect(spaceFlightPath).toHaveAttribute("data-speed", "4");
    expect(screen.getByText("Flight pace: 4x")).toBeInTheDocument();

    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("celebrates clearing level 1 and launches the spaceship into level 2", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);

    render(<PlaneGame />);
    fireEvent.click(screen.getByRole("button", { name: "Start flight" }));

    act(() => {
      vi.advanceTimersByTime(30 * 700);
    });

    expect(screen.getByRole("status")).toHaveTextContent(/Level 1 complete/);
    expect(screen.getByRole("img", { name: /Level complete/ })).toHaveAttribute("data-level", "1");
    expect(screen.getByText("10", { selector: "p" })).toBeInTheDocument();
    expect(document.querySelector(".game-confetti-piece")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Launch level 2" }));

    const spaceFlightPath = screen.getByRole("img", { name: /Space flight/ });
    expect(spaceFlightPath).toHaveAttribute("data-level", "2");
    expect(spaceFlightPath).toHaveClass("from-slate-950");
    expect(screen.getByRole("heading", { name: "Cosmic Dodger" })).toBeInTheDocument();
    expect(screen.getByText("Flight pace: 1x")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(8 * 700);
    });

    expect(spaceFlightPath).toHaveAccessibleName(/Obstacles approaching: star/);

    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("completes finite space and ocean levels and starts a new journey from level 1", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);

    render(<PlaneGame />);
    fireEvent.click(screen.getByRole("button", { name: "Start flight" }));
    act(() => {
      vi.advanceTimersByTime(30 * 700);
    });
    fireEvent.click(screen.getByRole("button", { name: "Launch level 2" }));

    expect(screen.getByText(/Level 2 · 0\/60 obstacles/)).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(80 * 700);
    });

    expect(screen.getByRole("status")).toHaveTextContent(/Level 2 complete/);
    expect(screen.getByText("60", { selector: "p" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Launch level 3" }));

    const oceanBoard = screen.getByRole("img", { name: /Ocean run/ });
    expect(oceanBoard).toHaveAttribute("data-level", "3");
    expect(oceanBoard).toHaveClass("from-cyan-950");
    expect(screen.getByRole("heading", { name: "Reef Runner" })).toBeInTheDocument();
    expect(screen.getByText(/Pilot a submarine/)).toBeInTheDocument();
    expect(screen.getByText(/Level 3 · 0\/110 obstacles/)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(8 * 700);
    });
    expect(oceanBoard).toHaveAccessibleName(/Obstacles approaching: seaweed/);

    act(() => {
      vi.advanceTimersByTime(140 * 700);
    });
    expect(screen.getByRole("status")).toHaveTextContent(/Level 3 complete/);
    fireEvent.click(screen.getByRole("button", { name: "Launch level 4" }));

    const arcticBoard = screen.getByRole("img", { name: /Arctic run/ });
    expect(arcticBoard).toHaveAttribute("data-level", "4");
    expect(arcticBoard).toHaveClass("from-sky-100");
    expect(screen.getByRole("heading", { name: "Arctic Dash" })).toBeInTheDocument();
    expect(screen.getByText(/snowballs, penguins, and icebergs/)).toBeInTheDocument();
    expect(screen.getByText(/Level 4 · 0\/160 obstacles/)).toBeInTheDocument();
    expect(screen.getByText(/Use/)).toHaveClass("text-slate-700");

    act(() => {
      vi.advanceTimersByTime(8 * 700);
    });
    expect(arcticBoard).toHaveAccessibleName(/Obstacles approaching: snowball/);

    act(() => {
      vi.advanceTimersByTime(200 * 700);
    });
    expect(screen.getByRole("status")).toHaveTextContent(/completed every level/i);
    expect(screen.getByRole("button", { name: "Play again" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    expect(screen.getByRole("img", { name: /Plane in lane 4 of 7/ })).toHaveAttribute(
      "data-level",
      "1",
    );
    expect(screen.getByText(/Level 1 · 0\/10 obstacles/)).toBeInTheDocument();

    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns to level 1 after losing in level 2", () => {
    vi.useFakeTimers();
    const random = vi.spyOn(Math, "random").mockReturnValue(0);

    render(<PlaneGame />);
    fireEvent.click(screen.getByRole("button", { name: "Start flight" }));
    act(() => {
      vi.advanceTimersByTime(30 * 700);
    });
    fireEvent.click(screen.getByRole("button", { name: "Launch level 2" }));

    random.mockReturnValue(0.5);
    act(() => {
      vi.advanceTimersByTime(10 * 700);
    });

    expect(screen.getByRole("status")).toHaveTextContent(/Restart to return to level 1/);
    fireEvent.click(screen.getByRole("button", { name: "Restart from level 1" }));
    expect(screen.getByRole("img", { name: /Plane in lane 4 of 7/ })).toHaveAttribute(
      "data-level",
      "1",
    );
    expect(screen.getByText(/Level 1 · 0\/10 obstacles/)).toBeInTheDocument();

    vi.useRealTimers();
    vi.restoreAllMocks();
  });
});
