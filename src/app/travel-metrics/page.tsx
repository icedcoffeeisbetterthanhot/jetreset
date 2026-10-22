import { TravelHistoryMap } from "@components/travel-metrics/TravelHistoryMap";
import { TRAVEL_METRICS_PERIODS, type TravelMetricsPeriod } from "@lib/travelMetrics";
import { getTravelMetrics } from "@server/travelMetricsService";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Travel Metrics – JetReset",
  description: "Review your recorded travel history, flight statistics, and airport locations.",
};

const periodLabels: Record<TravelMetricsPeriod, string> = {
  month: "This month",
  "six-months": "Six months",
  year: "This year",
};

type TravelMetricsPageProps = {
  searchParams: Promise<{ period?: string | string[] }>;
};

function parsePeriod(value: string | string[] | undefined): TravelMetricsPeriod {
  if (typeof value !== "string") return "month";
  return TRAVEL_METRICS_PERIODS.find((period) => period === value) ?? "month";
}

function formatDuration(minutes: number): string {
  const totalMinutes = Math.round(minutes);
  const hours = Math.floor(totalMinutes / 60);
  const remainder = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${remainder}m` : `${remainder}m`;
}

function formatDistance(distanceKm: number): string {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(Math.round(distanceKm));
}

export default async function TravelMetricsPage({ searchParams }: TravelMetricsPageProps) {
  const { period: rawPeriod } = await searchParams;
  const period = parsePeriod(rawPeriod);
  const report = await getTravelMetrics(period);
  const exportHref = `/api/travel-metrics/export?period=${period}`;
  const maxFlights = Math.max(1, ...report.months.map((month) => month.flights));

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
      <header className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-surface-strong">
            Travel Metrics
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            Your completed flight records, measured from saved itineraries and any current
            provider-confirmed flight times.
          </p>
        </div>
        <a
          href={exportHref}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white shadow-soft hover:bg-brand-dark focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          Download report (CSV)
        </a>
      </header>

      <nav aria-label="Reporting period" className="mb-8 flex flex-wrap gap-2">
        {TRAVEL_METRICS_PERIODS.map((option) => (
          <Link
            key={option}
            href={`/travel-metrics?period=${option}`}
            aria-current={period === option ? "page" : undefined}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              period === option
                ? "border-brand bg-brand text-white"
                : "border-slate-300 bg-surface text-slate-700 hover:border-brand hover:text-brand-dark"
            }`}
          >
            {periodLabels[option]}
          </Link>
        ))}
      </nav>

      <p className="mb-5 text-sm text-slate-500">
        {report.periodLabel} · Reporting dates and monthly totals use UTC.
      </p>

      <section
        aria-label={`${periodLabels[period]} summary`}
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <article className="rounded-xl border border-slate-200 bg-surface p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Distance travelled</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-surface-strong">
            {report.totals.distanceFlights === 0 ? (
              "Unavailable"
            ) : (
              <>
                {formatDistance(report.totals.distanceKm)} <span className="text-base">km</span>
              </>
            )}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {report.totals.distanceMissingFlights > 0
              ? `${report.totals.distanceFlights} flights measured; ${report.totals.distanceMissingFlights} missing airport coordinates`
              : "Great-circle estimate, not flight-track distance"}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-surface p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Time in the air</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-surface-strong">
            {formatDuration(report.totals.airTimeMinutes)}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {report.totals.verifiedFlights} actual · {report.totals.estimatedFlights} scheduled
            estimates
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-surface p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Flights</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-surface-strong">
            {report.totals.flights}
          </p>
          <p className="mt-2 text-xs text-slate-500">Completed flight segments in this period</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-surface p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Trips completed</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-surface-strong">
            {report.totals.completedTrips}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Trips use recorded arrivals; provider confirmation is identified per flight.{" "}
            {report.totals.airportTimeMinutes > 0
              ? `${formatDuration(report.totals.airportTimeMinutes)} verified airport time`
              : "Airport time shown only when actual connecting-flight times are available"}
          </p>
        </article>
      </section>

      <section
        aria-labelledby="monthly-heading"
        className="mt-10 rounded-xl border border-slate-200 bg-surface p-5 shadow-sm sm:p-6"
      >
        <h2 id="monthly-heading" className="text-xl font-semibold text-surface-strong">
          Monthly activity
        </h2>
        <div className="mt-5 space-y-3">
          {report.months.map((month) => (
            <div
              key={month.key}
              className="grid grid-cols-[4rem_minmax(0,1fr)_2.5rem] items-center gap-3"
            >
              <span className="text-sm text-slate-600">{month.label}</span>
              <div
                role="img"
                aria-label={`${month.flights} flights`}
                className="h-3 overflow-hidden rounded-full bg-slate-100"
              >
                <div
                  className="h-full rounded-full bg-brand"
                  style={{
                    width: `${month.flights === 0 ? 0 : Math.max(4, (month.flights / maxFlights) * 100)}%`,
                  }}
                />
              </div>
              <span className="text-right text-sm font-medium text-surface-strong">
                {month.flights}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-6 overflow-x-auto border-t border-slate-200 pt-4">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="py-2 pr-4">
                  Month (UTC)
                </th>
                <th scope="col" className="px-4 py-2 text-right">
                  Flights
                </th>
                <th scope="col" className="px-4 py-2 text-right">
                  Distance
                </th>
                <th scope="col" className="px-4 py-2 text-right">
                  Missing coordinates
                </th>
                <th scope="col" className="py-2 pl-4 text-right">
                  Air time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.months.map((month) => (
                <tr key={month.key}>
                  <th scope="row" className="py-2 pr-4 font-medium text-surface-strong">
                    {month.key}
                  </th>
                  <td className="px-4 py-2 text-right text-slate-600">{month.flights}</td>
                  <td className="px-4 py-2 text-right text-slate-600">
                    {month.distanceFlights === 0
                      ? "Unavailable"
                      : `${formatDistance(month.distanceKm)} km`}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-600">
                    {month.distanceMissingFlights}
                  </td>
                  <td className="py-2 pl-4 text-right text-slate-600">
                    {formatDuration(month.airTimeMinutes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-5 text-xs text-slate-500">
          Flight counts and distance are grouped by departure month. Air time is grouped by UTC
          calendar month; overlapping flight-time intervals are counted once.
        </p>
      </section>

      <section aria-labelledby="map-heading" className="mt-10 space-y-4">
        <div>
          <h2 id="map-heading" className="text-xl font-semibold text-surface-strong">
            Airport locations
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Select a marker to inspect trips that used that airport. Pins use bundled OurAirports
            coordinates over a public-domain Natural Earth outline; no map-tile service receives
            your travel history.
          </p>
        </div>
        <TravelHistoryMap airports={report.airports} />
        <p className="text-xs text-slate-500">
          Markers show recorded airport locations only. Flight paths are not drawn because saved
          itineraries do not contain aircraft track data.
        </p>
      </section>

      <section aria-labelledby="history-heading" className="mt-10">
        <h2 id="history-heading" className="text-xl font-semibold text-surface-strong">
          Travel history
        </h2>
        {report.flights.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-surface p-6 text-sm text-slate-600">
            No completed flight segments are recorded for this period. Add flights to a trip to see
            them included here.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-surface shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Flight
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Route
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Departure (UTC)
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Air time
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Distance
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Time source
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.flights.map((flight, index) => (
                  <tr
                    key={`${flight.tripId}-${flight.departureAirportCode}-${flight.arrivalAirportCode}-${flight.departureAt}-${index}`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/trips/${flight.tripId}`}
                        className="font-medium text-brand-dark underline-offset-4 hover:underline"
                      >
                        {flight.tripName}
                      </Link>
                      <span className="block text-xs capitalize text-slate-500">
                        {flight.leg} leg
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-surface-strong">
                      {flight.departureAirportCode} → {flight.arrivalAirportCode}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {new Intl.DateTimeFormat("en", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "UTC",
                      }).format(new Date(flight.departureAt))}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {formatDuration(flight.airTimeMinutes)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {flight.distanceKm === null
                        ? "Unavailable"
                        : `${formatDistance(flight.distanceKm)} km`}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {flight.timeBasis === "actual" ? "Provider actual" : "Schedule estimate"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <details className="mt-10 rounded-xl border border-slate-200 bg-surface p-5">
        <summary className="cursor-pointer font-semibold text-surface-strong">
          How these statistics are calculated
        </summary>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
          <li>
            Only persisted flight segments with an arrival in the past are included. A trip is
            counted when its latest saved flight segment has arrived; when actual provider data is
            missing, completion is inferred from its saved scheduled arrival.
          </li>
          <li>
            Current provider-confirmed actual times are used when available; otherwise saved
            scheduled times are estimates. Stale provider snapshots are ignored.
          </li>
          <li>
            Distance uses airport coordinates from the bundled OurAirports scheduled-service dataset
            and the Haversine great-circle formula. It is not the distance flown; flights without
            coordinates are counted separately and omitted from the distance total.
          </li>
          <li>
            Duplicate saved segments are counted once. Overlapping time intervals are merged for
            air-time totals. Airport time includes only positive layovers between adjacent flights
            with current provider-confirmed actual times at the same airport.
          </li>
          <li>
            Monthly, six-month, and yearly periods follow UTC calendar boundaries. Airport locations
            and reports are visible only to the current trip owner.
          </li>
        </ul>
      </details>

      <p className="mt-5 text-xs text-slate-500">
        Report generated {report.generatedAt.toISOString()} · Distances are estimates and flight
        history depends on the accuracy of saved itineraries and available provider data.
      </p>
    </div>
  );
}
