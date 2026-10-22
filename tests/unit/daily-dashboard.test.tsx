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
    activity({
      id: 13,
      type: "meal",
      title: "Lunch",
      scheduledAt: "2026-06-01T16:30:00.000Z",
      endsAt: "2026-06-01T17:15:00.000Z",
    }),
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
    expect(within(schedule).getByText("13:15")).toBeInTheDocument();
    const lunchCard = within(schedule).getByRole("checkbox", {
      name: "Mark complete: Lunch at 12:30",
    }).parentElement as HTMLElement;
    expect(lunchCard).toHaveTextContent(/Start\s*12:30\s*End\s*13:15\s*45 min/);
    const waterCard = within(schedule).getByRole("checkbox", {
      name: "Mark complete: Pause for water at 11:00",
    }).parentElement as HTMLElement;
    expect(waterCard).toHaveTextContent("End time not set");
    expect(
      screen.getByRole("link", { name: "Regenerate the plan on the trip page" }),
    ).toHaveAttribute("href", "/trips/4");
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

describe("DailyDashboard personal activities", () => {
  const meeting = {
    id: 31,
    title: "Client meeting",
    notes: "Bring slides",
    // 12:00–13:00 in New York, overlapping lunch (12:30–13:15).
    startsAt: "2026-06-01T16:00:00.000Z",
    endsAt: "2026-06-01T17:00:00.000Z",
    timeZone,
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-01T14:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows your activities in the calendar with times and plan overlaps", () => {
    render(
      <DailyDashboard
        {...baseProps}
        personalActivities={[meeting]}
        initialNow="2026-06-01T14:00:00.000Z"
      />,
    );

    const schedule = screen.getByRole("list", { name: "Schedule for Day 1" });
    const card = within(schedule).getByRole("button", { name: "Edit Client meeting" }).parentElement
      ?.parentElement?.parentElement as HTMLElement;
    expect(card).toHaveTextContent(/Start\s*12:00\s*End\s*13:00\s*1 h/);
    expect(card).toHaveTextContent("Your activity");
    expect(card).toHaveTextContent("Bring slides");
    expect(card).toHaveTextContent("Overlaps with your plan: Lunch (12:30–13:15)");
    expect(
      within(screen.getByRole("list", { name: "Activity types" })).getByText("Your activity"),
    ).toBeInTheDocument();
  });

  it("adds an activity to the selected day in that day's time zone", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 40,
        title: "Dinner with friends",
        notes: null,
        startsAt: "2026-06-01T23:00:00.000Z",
        endsAt: "2026-06-02T01:00:00.000Z",
        timeZone,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<DailyDashboard {...baseProps} initialNow="2026-06-01T14:00:00.000Z" />);

    fireEvent.click(screen.getByRole("button", { name: "Add activity" }));
    const form = screen.getByRole("form", { name: "Add your activity" });
    fireEvent.change(within(form).getByLabelText("Title"), {
      target: { value: "Dinner with friends" },
    });
    fireEvent.change(within(form).getByLabelText("Start time"), { target: { value: "19:00" } });
    fireEvent.change(within(form).getByLabelText("End time"), { target: { value: "21:00" } });
    await act(async () => {
      fireEvent.click(within(form).getByRole("button", { name: "Add to calendar" }));
      for (let index = 0; index < 5; index += 1) await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/trips/4/personal-activities",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      title: "Dinner with friends",
      notes: "",
      date: "2026-06-01",
      startTime: "19:00",
      endTime: "21:00",
      timeZone,
    });
    expect(screen.queryByRole("form", { name: "Add your activity" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Dinner with friends" })).toBeInTheDocument();
  });

  it("checks that the activity ends after it starts before saving", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<DailyDashboard {...baseProps} initialNow="2026-06-01T14:00:00.000Z" />);

    fireEvent.click(screen.getByRole("button", { name: "Add activity" }));
    const form = screen.getByRole("form", { name: "Add your activity" });
    fireEvent.change(within(form).getByLabelText("Title"), { target: { value: "Call" } });
    fireEvent.change(within(form).getByLabelText("Start time"), { target: { value: "15:00" } });
    fireEvent.change(within(form).getByLabelText("End time"), { target: { value: "14:00" } });
    fireEvent.submit(form);

    expect(within(form).getByRole("alert")).toHaveTextContent("must end after it starts");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("deletes an activity after confirmation", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => null });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
    render(
      <DailyDashboard
        {...baseProps}
        personalActivities={[meeting]}
        initialNow="2026-06-01T14:00:00.000Z"
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete Client meeting" }));
      for (let index = 0; index < 5; index += 1) await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/trips/4/personal-activities/31", {
      method: "DELETE",
    });
    expect(screen.queryByText("Client meeting")).not.toBeInTheDocument();
  });
});
