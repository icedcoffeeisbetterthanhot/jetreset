import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { TravelHistoryMap } from "@components/travel-metrics/TravelHistoryMap";
import type { TravelMetricsAirport } from "@lib/travelMetrics";

const london: TravelMetricsAirport = {
  code: "LHR",
  name: "Heathrow Airport",
  city: "London",
  countryCode: "GB",
  timeZone: "Europe/London",
  latitude: 51.47,
  longitude: -0.4543,
  flightCount: 2,
  trips: [{ id: 1, name: "London trip" }],
};

const newYork: TravelMetricsAirport = {
  code: "JFK",
  name: "John F. Kennedy International Airport",
  city: "New York",
  countryCode: "US",
  timeZone: "America/New_York",
  latitude: 40.6413,
  longitude: -73.7781,
  flightCount: 1,
  trips: [{ id: 2, name: "New York trip" }],
};

describe("TravelHistoryMap", () => {
  it("shows airport markers and lets the user inspect the trips at a location", () => {
    render(<TravelHistoryMap airports={[london, newYork]} />);

    expect(
      screen.getByRole("group", {
        name: "Airport locations on an equirectangular world coordinate map",
      }),
    ).toBeInTheDocument();
    expect(document.querySelector('image[href="/world-land.svg"]')).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /LHR, London/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /JFK, New York/ }));

    expect(screen.getByRole("heading", { name: "New York" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New York trip" })).toHaveAttribute("href", "/trips/2");
  });

  it("keeps the world map visible and explains the empty state when there are no locations", () => {
    render(<TravelHistoryMap airports={[]} />);

    expect(
      screen.getByRole("group", {
        name: "Airport locations on an equirectangular world coordinate map",
      }),
    ).toBeInTheDocument();
    expect(document.querySelector('image[href="/world-land.svg"]')).toBeInTheDocument();
    expect(screen.getByText("Completed flight locations will appear here.")).toBeInTheDocument();
    expect(screen.getByText(/Add completed flights to your trips/)).toBeInTheDocument();
  });
});
