import airportData from "../data/airports.json";

export interface Airport {
  code: string;
  name: string;
  city: string | null;
  countryCode: string | null;
  timeZone: string;
  latitude?: number;
  longitude?: number;
}

const airports = airportData as Airport[];
const airportsByCode = new Map(airports.map((airport) => [airport.code, airport]));

export function findAirport(code: string): Airport | null {
  return airportsByCode.get(code.trim().toUpperCase()) ?? null;
}

export function searchAirports(query: string, limit = 20): Airport[] {
  const normalizedQuery = query
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  if (normalizedQuery.length < 2) return [];

  return airports
    .filter((airport) => {
      const searchableText = [
        airport.code,
        airport.name,
        airport.city ?? "",
        airport.countryCode ?? "",
      ]
        .join(" ")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      return searchableText.includes(normalizedQuery);
    })
    .slice(0, Math.max(1, Math.min(limit, 50)));
}
