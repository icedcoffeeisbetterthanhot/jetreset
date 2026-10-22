import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { DailyDashboard } from "@components/dashboard/DailyDashboard";
import type { RecoveryActivityView, RecoveryPlanView } from "@lib/recoveryDashboard";

const timeZone = "America/New_York";

function activity(
  overrides: Partial<RecoveryActivityView> &
    Pick<RecoveryActivityView, "id" | "type" | "title" | "scheduledAt">,
): RecoveryActivityView {
  return {
    activityKey: `key-${overrides.id}`,
    dayNumber: 1,
    guidance: `Guidance for ${overrides.title}.`,
    timeZone,
    completedAt: null,
    ...overrides,
  };
}

const plan: RecoveryPlanView = {
  sourceTripUpdatedAt: "2026-05-30T12:00:00.000Z",
  destinationTimeZone: timeZone,
  journeyDurationMinutes: 420,
  direction: "west",
  timeZoneChangeMinutes: -300,
  estimatedTimeZonesCrossed: 5,
  recoveryDays: 5,
  targetBedtime: "22:00",
  targetWakeTime: "07:00",
  avoidCaffeine: false,
  preparationDaysAvailable: 0,
  assumptions: ["This is general educational planning, not medical advice."],
  activities: [
    activity({
      id: 11,
      type: "light",
      title: "Get outdoor daylight when practical",
      scheduledAt: "2026-06-01T13:00:00.000Z",
      completedAt: "2026-06-01T13:10:00.000Z",
    }),
    activity({
      id: 12,
      type: "hydration",
      title: "Pause for water",
      scheduledAt: "2026-06-01T15:00:00.000Z",
    }),
    activity({ id: 13, type: "meal", title: "Lunch", scheduledAt: "2026-06-01T16:30:00.000Z" }),
    activity({
      id: 14,
      type: "caffeine",
      title: "Keep caffeine early, if you use it",
      scheduledAt: "2026-06-01T18:00:00.000Z",
    }),
    activity({
      id: 15,
      type: "exercise",
      title: "Gentle movement",
      scheduledAt: "2026-06-01T20:30:00.000Z",
    }),
    activity({
      id: 16,
      type: "sleep",
      title: "Target bedtime",
      scheduledAt: "2026-06-02T02:00:00.000Z",
    }),
    activity({
      id: 17,
      dayNumber: 2,
      type: "sleep",
      title: "Target wake time",
      scheduledAt: "2026-06-02T11:00:00.000Z",
    }),
  ],
};

const baseProps = {
  tripId: 4,
  departureAt: "2026-05-31T10:00:00.000Z",
  arrivalAt: "2026-06-01T11:00:00.000Z",
  destinationTimeZone: timeZone,
  plan,
  planIsOutOfDate: false,
};

describe("DailyDashboard", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows sleep targets, every guidance category, and today's progress", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T14:00:00.000Z"));
    render(<DailyDashboard {...baseProps} initialNow="2026-06-01T14:00:00.000Z" />);

    expect(screen.getByText("Recovery day 1 of 5")).toBeInTheDocument();
    expect(screen.getByText("Next target sleep time")).toBeInTheDocument();
    expect(screen.getByText("Mon 1 Jun, 22:00")).toBeInTheDocument();
    expect(screen.getByText("Next wake-time target")).toBeInTheDocument();
    expect(screen.getByText("Tue 2 Jun, 07:00")).toBeInTheDocument();
    expect(screen.getByText("11:00 · Pause for water")).toBeInTheDocument();
    expect(screen.getByText("1 of 6 complete · 17%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Today's activity progress" })).toHaveAttribute(
      "aria-valuenow",
      "17",
    );

    const legend = screen.getByRole("list", { name: "Activity types" });
    for (const label of ["Sleep", "Light exposure", "Meal", "Hydration", "Exercise", "Caffeine"]) {
      expect(within(legend).getByText(label)).toBeInTheDocument();
    }
  });

  it("lays out the current day as an hourly calendar with times and a now marker", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T14:00:00.000Z"));
    render(<DailyDashboard {...baseProps} initialNow="2026-06-01T14:00:00.000Z" />);

    expect(
      screen.getByRole("button", { name: /^Day 1, Monday,? 1 June 2026, today/ }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("heading", { level: 3, name: /Day 1 · Monday,? 1 June 2026/ }),
    ).toBeInTheDocument();
    const schedule = screen.getByRole("list", { name: "Schedule for Day 1" });
    const times = within(schedule)
      .getAllByRole("checkbox")
      .map((checkbox) => checkbox.getAttribute("aria-label"));
    expect(times).toEqual([
      "Mark incomplete: Get outdoor daylight when practical at 09:00",
      "Mark complete: Pause for water at 11:00",
      "Mark complete: Lunch at 12:30",
      "Mark complete: Keep caffeine early, if you use it at 14:00",
      "Mark complete: Gentle movement at 16:30",
      "Mark complete: Target bedtime at 22:00",
    ]);
    expect(within(schedule).getByText("Now · 10:00")).toBeInTheDocument();
    expect(within(schedule).getByText("13:00")).toBeInTheDocument();
    expect(within(schedule).getAllByText("Completed")).toHaveLength(1);
    expect(within(schedule).getAllByText("Planned")).toHaveLength(5);
  });

  it("switches to another plan day without showing the now marker", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T14:00:00.000Z"));
    render(<DailyDashboard {...baseProps} initialNow="2026-06-01T14:00:00.000Z" />);

    fireEvent.click(screen.getByRole("button", { name: /^Day 2, Tuesday,? 2 June 2026/ }));

    const schedule = screen.getByRole("list", { name: "Schedule for Day 2" });
    expect(
      within(schedule).getByRole("checkbox", { name: "Mark complete: Target wake time at 07:00" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Now ·/)).not.toBeInTheDocument();
  });

  it("persists completion through the activity API and updates progress", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T14:00:00.000Z"));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 13, completedAt: "2026-06-01T16:35:00.000Z" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<DailyDashboard {...baseProps} initialNow="2026-06-01T14:00:00.000Z" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox", { name: "Mark complete: Lunch at 12:30" }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/trips/4/recovery/activities/13",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ completed: true }) }),
    );
    expect(screen.getByText("2 of 6 complete · 33%")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Mark incomplete: Lunch at 12:30" })).toBeChecked();
  });

  it("keeps progress unchanged and reports an error when saving fails", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T14:00:00.000Z"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Recovery activity not found." }),
      }),
    );
    render(<DailyDashboard {...baseProps} initialNow="2026-06-01T14:00:00.000Z" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox", { name: "Mark complete: Lunch at 12:30" }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Recovery activity not found.");
    expect(screen.getByText("1 of 6 complete · 17%")).toBeInTheDocument();
  });

  it("shows an in-transit empty state and an out-of-date warning", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-31T20:00:00.000Z"));
    render(<DailyDashboard {...baseProps} planIsOutOfDate initialNow="2026-05-31T20:00:00.000Z" />);

    expect(screen.getByText("In transit")).toBeInTheDocument();
    expect(screen.getByText(/You are in transit/)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Schedule for Day 1" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Regenerate it from the trip page" })).toHaveAttribute(
      "href",
      "/trips/4",
    );
  });
});
