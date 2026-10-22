import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import {
  FlightStatusPanel,
  type SegmentFlightStatusView,
  type TripFlightStatusView,
} from "@components/trips/FlightStatusPanel";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const segment: SegmentFlightStatusView = {
  segmentId: 7,
  flightNumber: "BA117",
  departureAirportCode: "LHR",
  arrivalAirportCode: "JFK",
  departureTimeZone: "Europe/London",
  arrivalTimeZone: "America/New_York",
  scheduledDepartureAt: "2026-10-22T11:30:00.000Z",
  scheduledArrivalAt: "2026-10-22T19:30:00.000Z",
  eligibility: { eligible: true },
  snapshot: null,
  changes: [],
  error: null,
};

const delayedSegment: SegmentFlightStatusView = {
  ...segment,
  snapshot: {
    current: true,
    provider: "aviationstack",
    lookupResult: "found",
    status: "delayed",
    providerScheduledDepartureAt: "2026-10-22T11:30:00.000Z",
    estimatedDepartureAt: "2026-10-22T13:05:00.000Z",
    actualDepartureAt: null,
    providerScheduledArrivalAt: "2026-10-22T19:30:00.000Z",
    estimatedArrivalAt: "2026-10-22T20:50:00.000Z",
    actualArrivalAt: null,
    providerUpdatedAt: "2026-10-22T07:55:00.000Z",
    fetchedAt: "2026-10-22T08:00:00.000Z",
  },
  changes: ["Departure 1 h 35 min later than planned (estimated Thu 22 Oct, 14:05)"],
};

const configured: TripFlightStatusView = {
  configured: true,
  recoveryPlanUpdatePending: false,
  blockingAlerts: [],
  segments: [segment],
};

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body };
}

async function flush() {
  for (let index = 0; index < 5; index += 1) await Promise.resolve();
}

describe("FlightStatusPanel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    refresh.mockReset();
  });

  it("states clearly when live status is not configured", () => {
    render(
      <FlightStatusPanel tripId={4} hasPlan initialStatus={{ ...configured, configured: false }} />,
    );

    expect(screen.getByText(/Live flight status isn't configured/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check flight status" })).not.toBeInTheDocument();
    expect(screen.getByRole("table")).toHaveTextContent("22 Oct, 12:30");
  });

  it("checks status and shows scheduled, estimated, and changed times separately", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        ...configured,
        recoveryPlanUpdatePending: true,
        segments: [delayedSegment],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<FlightStatusPanel tripId={4} hasPlan initialStatus={configured} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Check flight status" }));
      await flush();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/trips/4/flight-status", { method: "POST" });
    expect(screen.getByText("Delayed")).toBeInTheDocument();
    const departureRow = within(screen.getByRole("table")).getByRole("row", {
      name: /Departure LHR/,
    });
    expect(
      within(departureRow)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(["22 Oct, 12:30", "22 Oct, 12:30", "22 Oct, 14:05", "—"]);
    expect(screen.getByText(/Departure 1 h 35 min later than planned/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update recovery plan" })).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("applies verified changes to the recovery plan", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ plan: {} }))
      .mockResolvedValueOnce(jsonResponse({ ...configured, segments: [delayedSegment] }));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <FlightStatusPanel
        tripId={4}
        hasPlan
        initialStatus={{
          ...configured,
          recoveryPlanUpdatePending: true,
          segments: [delayedSegment],
        }}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Update recovery plan" }));
      await flush();
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/trips/4/recovery/flight-status", {
      method: "POST",
    });
    expect(screen.getByText(/Recovery plan updated/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update recovery plan" })).not.toBeInTheDocument();
  });

  it("blocks automatic plan changes for cancellations", () => {
    render(
      <FlightStatusPanel
        tripId={4}
        hasPlan
        initialStatus={{
          ...configured,
          recoveryPlanUpdatePending: true,
          blockingAlerts: ["BA117 LHR→JFK: Cancelled by the operator"],
        }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Cancelled by the operator");
    expect(screen.queryByRole("button", { name: "Update recovery plan" })).not.toBeInTheDocument();
  });

  it("reports provider errors and ineligible segments", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(jsonResponse({ error: "Live flight status is not configured." }, false)),
    );
    render(
      <FlightStatusPanel
        tripId={4}
        hasPlan={false}
        initialStatus={{
          ...configured,
          segments: [
            segment,
            { ...segment, segmentId: 8, eligibility: { eligible: false, reason: "too_early" } },
          ],
        }}
      />,
    );

    expect(screen.getByText("Status checks open 7 days before departure.")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Check flight status" }));
      await flush();
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Live flight status is not configured.");
  });
});
