import { NextRequest, NextResponse } from "next/server";
import { TRAVEL_METRICS_PERIODS, type TravelMetricsPeriod } from "@lib/travelMetrics";
import { tripApiErrorResponse } from "@server/tripApiError";
import { getTravelMetrics } from "@server/travelMetricsService";

export const dynamic = "force-dynamic";

function isTravelMetricsPeriod(value: string): value is TravelMetricsPeriod {
  return TRAVEL_METRICS_PERIODS.some((period) => period === value);
}

function csvCell(value: string | number | null, userText = false): string {
  if (value === null) return "";
  let text = String(value);
  if (userText && /^\s*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(report: Awaited<ReturnType<typeof getTravelMetrics>>): string {
  const rows: Array<Array<string | number | null>> = [
    ["JetReset travel report", report.periodLabel],
    ["Reporting time zone", "UTC"],
    ["Generated at", report.generatedAt.toISOString()],
    ["Distance (km, great-circle estimate)", report.totals.distanceKm.toFixed(1)],
    ["Flights with distance coordinates", report.totals.distanceFlights],
    ["Flights without distance coordinates", report.totals.distanceMissingFlights],
    ["Air time (minutes; actual or scheduled estimate)", report.totals.airTimeMinutes.toFixed(0)],
    ["Flights", report.totals.flights],
    ["Provider-confirmed flights", report.totals.verifiedFlights],
    ["Schedule-estimated flights", report.totals.estimatedFlights],
    ["Verified airport time (minutes)", report.totals.airportTimeMinutes.toFixed(0)],
    ["Completed trips", report.totals.completedTrips],
    [],
    ["Monthly breakdown"],
    [
      "Month (UTC)",
      "Flights",
      "Great-circle distance (km)",
      "Flights with coordinates",
      "Flights without coordinates",
      "Air time (minutes)",
    ],
    ...report.months.map((month) => [
      month.key,
      month.flights,
      month.distanceKm.toFixed(1),
      month.distanceFlights,
      month.distanceMissingFlights,
      month.airTimeMinutes.toFixed(0),
    ]),
    [],
    ["Completed flights"],
    [
      "Trip",
      "Journey leg",
      "Departure airport",
      "Arrival airport",
      "Departure (UTC)",
      "Arrival (UTC)",
      "Time basis",
      "Air time (minutes)",
      "Great-circle distance (km)",
    ],
    ...report.flights.map((flight) => [
      flight.tripName,
      flight.leg,
      flight.departureAirportCode,
      flight.arrivalAirportCode,
      flight.departureAt,
      flight.arrivalAt,
      flight.timeBasis,
      flight.airTimeMinutes.toFixed(0),
      flight.distanceKm?.toFixed(1) ?? null,
    ]),
  ];

  return `\uFEFF${rows
    .map((row) =>
      row.map((value, index) => csvCell(value, index === 0 && typeof value === "string")).join(","),
    )
    .join("\r\n")}\r\n`;
}

export async function GET(request: NextRequest) {
  const requestedPeriod = request.nextUrl.searchParams.get("period");
  if (requestedPeriod !== null && !isTravelMetricsPeriod(requestedPeriod)) {
    return NextResponse.json({ error: "Choose a supported reporting period." }, { status: 400 });
  }

  try {
    const period: TravelMetricsPeriod = requestedPeriod ?? "month";
    const report = await getTravelMetrics(period);
    const filename = `jetreset-travel-report-${period}-${report.generatedAt.toISOString().slice(0, 10)}.csv`;

    return new NextResponse(toCsv(report), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return tripApiErrorResponse(error, "Unable to generate the travel report.");
  }
}
