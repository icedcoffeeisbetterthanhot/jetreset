import { findAirport, searchAirports } from "@server/airportService";

describe("airport service", () => {
  it("looks up verified airport codes case-insensitively", () => {
    expect(findAirport("lhr")).toMatchObject({
      code: "LHR",
      city: "London",
      timeZone: "Europe/London",
      latitude: expect.any(Number),
      longitude: expect.any(Number),
    });
    expect(findAirport("ZZZ")).toBeNull();
  });

  it("searches airport code, city, and name without requiring exact case", () => {
    expect(searchAirports("new york").some((airport) => airport.code === "JFK")).toBe(true);
    expect(searchAirports("Heathrow")[0]).toMatchObject({ code: "LHR" });
    expect(searchAirports("LHR")[0]).toMatchObject({ code: "LHR" });
  });

  it("returns no results for a search that is too short", () => {
    expect(searchAirports("L")).toEqual([]);
  });
});
