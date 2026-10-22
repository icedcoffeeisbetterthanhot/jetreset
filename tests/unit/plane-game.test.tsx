import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import PlaneGame from "../../src/components/game/PlaneGame";
import {
  CLOUD_DODGER_OBSTACLES,
  createCloudDodgerRandom,
  simulateCloudDodgerRun,
} from "@lib/cloudDodger";

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
      vi.advanceTimersByTime(100 * 700);
    });

    expect(screen.getByRole("status")).toHaveTextContent(/Flight over/i);
    expect(screen.getByRole("img", { name: /Game over/ })).toBeInTheDocument();
    expect(screen.getByText(/Flight over!/i)).toBeInTheDocument();
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
    let seed = 1;
    for (; seed < 10_000; seed += 1) {
      const simulation = simulateCloudDodgerRun(seed, [], 32);
      const nextRandom = createCloudDodgerRandom(seed);
      const types = Array.from({ length: 8 }, () => {
        nextRandom();
        return CLOUD_DODGER_OBSTACLES[Math.floor(nextRandom() * CLOUD_DODGER_OBSTACLES.length)];
      });
      if (!simulation.crashed && CLOUD_DODGER_OBSTACLES.every((type) => types.includes(type))) {
        break;
      }
    }
    random.mockReturnValueOnce((seed - 1) / 2_147_483_646);

    render(<PlaneGame />);
    fireEvent.click(screen.getByRole("button", { name: "Start flight" }));
    const flightPath = screen.getByRole("img", { name: /Flight path/ });

    act(() => {
      vi.advanceTimersByTime(8 * 700);
    });

    expect(flightPath).toHaveAccessibleName(/Obstacles approaching:.*white cloud/);
    expect(flightPath).toHaveAccessibleName(/Obstacles approaching:.*bird/);
    expect(flightPath).toHaveAccessibleName(/Obstacles approaching:.*balloon/);
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
