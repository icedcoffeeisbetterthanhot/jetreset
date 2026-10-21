import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { RecoveryDashboard } from "@components/trips/RecoveryDashboard";

const plan = {
  sourceTripUpdatedAt: "2026-05-30T12:00:00.000Z",
  destinationTimeZone: "America/New_York",
  journeyDurationMinutes: 420,
  direction: "west" as const,
  timeZoneChangeMinutes: -300,
  estimatedTimeZonesCrossed: 5,
  recoveryDays: 5,
  targetBedtime: "22:00",
  targetWakeTime: "07:00",
  avoidCaffeine: false,
  preparationDaysAvailable: 0,
  assumptions: ["This is general educational planning, not medical advice."],
  activities: [
    {
      id: 17,
      activityKey: "1-light-20260601T0900",
      dayNumber: 1,
      type: "light" as const,
      title: "Get outdoor daylight when practical",
      guidance: "General destination-local guidance.",
      scheduledAt: "2026-06-01T13:00:00.000Z",
      timeZone: "America/New_York",
      completedAt: null,
    },
    {
      id: 18,
      activityKey: "1-sleep-20260601T2200",
      dayNumber: 1,
      type: "sleep" as const,
      title: "Target bedtime",
      guidance: "Use this as a flexible target.",
      scheduledAt: "2026-06-02T02:00:00.000Z",
      timeZone: "America/New_York",
      completedAt: null,
    },
  ],
};

describe("RecoveryDashboard", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("provides preferences and a clear empty state before a plan exists", () => {
    render(
      <RecoveryDashboard
        tripId={4}
        departureAt="2026-06-02T10:00:00.000Z"
        arrivalAt="2026-06-02T17:00:00.000Z"
        destinationTimeZone="America/New_York"
        initialPlan={null}
        initialPlanIsOutOfDate={false}
      />,
    );

    expect(screen.getByText(/Generate a destination-local schedule/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Preferred wake-time target/)).toHaveValue("07:00");
    expect(screen.getByLabelText(/Preferred bedtime target/)).toHaveValue("22:00");
    expect(screen.getByRole("button", { name: "Generate recovery plan" })).toBeInTheDocument();
  });

  it("shows current-day activities, completion progress, and accepts persisted completion", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T13:00:00.000Z"));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 17, completedAt: "2026-06-01T13:00:00.000Z" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <RecoveryDashboard
        tripId={4}
        departureAt="2026-05-31T10:00:00.000Z"
        arrivalAt="2026-06-01T11:00:00.000Z"
        destinationTimeZone="America/New_York"
        initialPlan={plan}
        initialPlanIsOutOfDate={false}
      />,
    );

    expect(screen.getByText("Recovery day 1 of 5")).toBeInTheDocument();
    expect(screen.getByText("0 of 2 activities complete · 0%")).toBeInTheDocument();
    expect(screen.getByText("Get outdoor daylight when practical")).toBeInTheDocument();
    expect(screen.getByText("Next target sleep time")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(
        screen.getByRole("checkbox", {
          name: "Mark complete: Get outdoor daylight when practical",
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/trips/4/recovery/activities/17",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(screen.getByText("1 of 2 activities complete · 50%")).toBeInTheDocument();
  });
});
