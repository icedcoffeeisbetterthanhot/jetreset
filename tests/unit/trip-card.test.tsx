import React from "react";
import { render, screen, within } from "@testing-library/react";
import { TripCard } from "@components/trips/TripCard";
import { arrivalDayOffset, getTripTimeline } from "@lib/tripTimeline";
import type { TripWithFlights } from "@server/tripService";

type Flight = TripWithFlights["flightSegments"][number];

const outboundFlight: Flight = {
  id: 1,
  leg: "outbound",
  airline: "British Airways",
  flightNumber: "BA117",
  departureAirportCode: "LHR",
  arrivalAirportCode: "JFK",
  departureTimeZone: "Europe/London",
  arrivalTimeZone: "America/New_York",
  scheduledDepartureAt: new Date("2026-10-22T11:30:00.000Z"),
  scheduledArrivalAt: new Date("2026-10-22T19:30:00.000Z"),
};

// Overnight flight home: leaves New York 29 Oct 18:00, lands London 30 Oct 06:00.
const returnFlight: Flight = {
  ...outboundFlight,
  id: 2,
  leg: "return",
  flightNumber: "BA178",
  departureAirportCode: "JFK",
  arrivalAirportCode: "LHR",
  departureTimeZone: "America/New_York",
  arrivalTimeZone: "Europe/London",
  scheduledDepartureAt: new Date("2026-10-29T22:00:00.000Z"),
  scheduledArrivalAt: new Date("2026-10-30T06:00:00.000Z"),
};

function trip(flightSegments: Flight[]): TripWithFlights {
  return {
    id: 1,
    name: "New York",
    origin: "London",
    destination: "New York",
    originTimeZone: "Europe/London",
    destinationTimeZone: "America/New_York",
    departureAt: new Date("2026-10-22T11:30:00.000Z"),
    arrivalAt: new Date("2026-10-22T17:30:00.000Z"),
    notes: null,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    flightSegments,
  };
}

function renderCard(value: TripWithFlights, now: Date) {
  return render(
    <ul>
      <TripCard trip={value} now={now} />
    </ul>,
  );
}

describe("getTripTimeline", () => {
  it("runs a round trip from the first outbound departure to the last return arrival", () => {
    const timeline = getTripTimeline(
      trip([returnFlight, outboundFlight]),
      new Date("2026-10-25T12:00:00.000Z"),
    );

    expect(timeline.outboundFlights.map((flight) => flight.id)).toEqual([1]);
    expect(timeline.returnFlights.map((flight) => flight.id)).toEqual([2]);
    expect(timeline.startsAt).toEqual(outboundFlight.scheduledDepartureAt);
    expect(timeline.endsAt).toEqual(returnFlight.scheduledArrivalAt);
    expect(timeline.stayNights).toBe(7);
    expect(timeline.status).toBe("in-progress");
  });

  it("uses the trip's own times when no flights are saved", () => {
    const value = trip([]);
    expect(getTripTimeline(value, new Date("2026-10-20T00:00:00.000Z"))).toMatchObject({
      startsAt: value.departureAt,
      endsAt: value.arrivalAt,
      stayNights: null,
      status: "upcoming",
    });
    expect(getTripTimeline(value, new Date("2026-10-23T00:00:00.000Z")).status).toBe("past");
  });

  it("counts local calendar days for overnight arrivals", () => {
    expect(arrivalDayOffset(outboundFlight)).toBe(0);
    expect(arrivalDayOffset(returnFlight)).toBe(1);
  });
});

describe("TripCard", () => {
  it("shows outbound and return flights side by side in local airport times", () => {
    renderCard(trip([outboundFlight, returnFlight]), new Date("2026-10-20T00:00:00.000Z"));

    expect(screen.getByText(/London ⇄ New York/)).toBeInTheDocument();
    expect(screen.getByText("Upcoming")).toBeInTheDocument();
    expect(screen.getByText("7 nights in New York")).toBeInTheDocument();

    const outbound = screen.getByRole("region", { name: "Outbound journey" });
    expect(outbound).toHaveTextContent("Thu, 22 Oct 2026");
    expect(outbound).toHaveTextContent("BA117 · British Airways");
    expect(outbound).toHaveTextContent("LHR 12:30");
    expect(outbound).toHaveTextContent("JFK 15:30");
    expect(outbound).toHaveTextContent("Direct · Total 8 hours");

    const inbound = screen.getByRole("region", { name: "Return journey" });
    expect(inbound).toHaveTextContent("BA178");
    expect(inbound).toHaveTextContent("JFK 18:00");
    expect(inbound).toHaveTextContent("LHR 06:00+1");

    expect(screen.getByRole("link", { name: "Flight Status" })).toHaveAttribute(
      "href",
      "/flight-status?trip=1",
    );
  });

  it("prompts for flights when a trip has none", () => {
    renderCard(trip([]), new Date("2026-10-20T00:00:00.000Z"));

    expect(screen.getByText(/London → New York/)).toBeInTheDocument();
    const outbound = screen.getByRole("region", { name: "Outbound journey" });
    expect(outbound).toHaveTextContent("London 12:30");
    expect(outbound).toHaveTextContent("New York 13:30");
    expect(within(outbound).getByRole("link", { name: "Add flights" })).toHaveAttribute(
      "href",
      "/trips/1#flight-itinerary-heading",
    );
    const inbound = screen.getByRole("region", { name: "Return journey" });
    expect(inbound).toHaveTextContent("No return flights yet.");
    expect(within(inbound).getByRole("link", { name: "Add return flights" })).toBeInTheDocument();
    expect(screen.queryByText(/nights in/)).not.toBeInTheDocument();
  });
});
