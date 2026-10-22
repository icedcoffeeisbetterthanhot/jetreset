import React from "react";
import { render, screen } from "@testing-library/react";
import { FlightPlanner } from "@components/trips/FlightPlanner";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const segment = {
  id: 12,
  leg: "outbound" as const,
  airline: "Example Air",
  flightNumber: "EX123",
  departureAirportCode: "LHR",
  departureAirportName: "London Heathrow Airport",
  departureAirportCity: "London",
  departureCountryCode: "GB",
  departureTimeZone: "Europe/London",
  arrivalAirportCode: "JFK",
  arrivalAirportName: "John F. Kennedy International Airport",
  arrivalAirportCity: "New York",
  arrivalCountryCode: "US",
  arrivalTimeZone: "America/New_York",
  scheduledDepartureAt: "2026-06-01T09:00:00.000Z",
  scheduledArrivalAt: "2026-06-01T17:00:00.000Z",
};

describe("FlightPlanner", () => {
  it("shows airport-local segment times and calculated journey information", () => {
    render(
      <FlightPlanner
        tripId={3}
        origin="London"
        destination="New York"
        initialSegments={[segment]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Flight itinerary" })).toBeInTheDocument();
    expect(screen.getByText("Example Air · EX123")).toBeInTheDocument();
    expect(screen.getByText("London Heathrow Airport, London")).toBeInTheDocument();
    expect(screen.getByText("John F. Kennedy International Airport, New York")).toBeInTheDocument();
    expect(screen.getByText("Total flight time")).toBeInTheDocument();
    expect(screen.getByText("Elapsed journey")).toBeInTheDocument();
    expect(screen.getByText(/Time-zone change: 5h behind/)).toBeInTheDocument();
  });

  it("groups outbound and return flights and calculates layovers within each leg", () => {
    const returnSegment = {
      ...segment,
      id: 13,
      leg: "return" as const,
      flightNumber: "EX124",
      departureAirportCode: "JFK",
      departureAirportName: "John F. Kennedy International Airport",
      departureAirportCity: "New York",
      departureTimeZone: "America/New_York",
      arrivalAirportCode: "LHR",
      arrivalAirportName: "London Heathrow Airport",
      arrivalAirportCity: "London",
      arrivalTimeZone: "Europe/London",
      scheduledDepartureAt: "2026-06-08T22:00:00.000Z",
      scheduledArrivalAt: "2026-06-09T05:00:00.000Z",
    };
    render(
      <FlightPlanner
        tripId={3}
        origin="London"
        destination="New York"
        initialSegments={[segment, returnSegment]}
      />,
    );

    const outbound = screen.getByRole("region", { name: /^Outbound/ });
    const inbound = screen.getByRole("region", { name: /^Return/ });
    expect(outbound).toHaveTextContent("London → New York");
    expect(outbound).toHaveTextContent("Example Air · EX123");
    expect(inbound).toHaveTextContent("New York → London");
    expect(inbound).toHaveTextContent("Example Air · EX124");
    // The week-long stay is not treated as a connecting layover.
    expect(screen.queryByText(/Layover at JFK/)).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Return (New York → London)" })).not.toBeChecked();
  });

  it("explains how to start an empty itinerary", () => {
    render(
      <FlightPlanner tripId={3} origin="London" destination="New York" initialSegments={[]} />,
    );

    expect(screen.getByText(/No flights added yet/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add flight" })).toBeInTheDocument();
  });
});
