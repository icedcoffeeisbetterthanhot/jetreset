import { TripActions } from "@components/trips/TripActions";
import { computeDurationMinutes, formatDuration } from "@lib/timezone";
import { getTripById } from "@server/tripService";
import { listFlightSegments } from "@server/flightService";
import { FlightPlanner } from "@components/trips/FlightPlanner";
import { RecoveryDashboard } from "@components/trips/RecoveryDashboard";
import { getRecoveryPlan } from "@server/recoveryService";
import { toRecoveryPlanView } from "@lib/recoveryDashboard";
import { RECOVERY_PLAN_LABELS, segmentsForLeg } from "@lib/journeyLeg";
import Link from "next/link";
import { notFound } from "next/navigation";

type TripDetailsPageProps = {
  params: Promise<{ id: string }>;
};

function formatTripTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date);
}

export default async function TripDetailsPage({ params }: TripDetailsPageProps) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) notFound();

  const trip = await getTripById(id);
  if (!trip) notFound();
  const flightSegments = await listFlightSegments(id);
  const recovery = await getRecoveryPlan(id, "outbound");
  const returnRecovery = await getRecoveryPlan(id, "return");
  const returnSegments = segmentsForLeg(flightSegments, "return");
  const firstReturn = returnSegments[0];
  const lastReturn = returnSegments[returnSegments.length - 1];
  const flightStatusNotices = [recovery, returnRecovery].filter(
    (result) => result.flightStatusAlerts.length > 0 || result.flightStatusChangePending,
  );

  const now = Date.now();
  const status =
    trip.arrivalAt.getTime() < now
      ? "Past trip"
      : trip.departureAt.getTime() <= now
        ? "In progress"
        : "Upcoming";
  const duration = formatDuration(computeDurationMinutes(trip.departureAt, trip.arrivalAt));

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:px-6 md:py-16">
      <nav aria-label="Trip navigation" className="flex flex-wrap gap-x-6 gap-y-2">
        <Link
          href="/trips"
          className="text-sm font-medium text-brand-dark underline-offset-4 hover:underline"
        >
          Back to trips
        </Link>
        <Link
          href={`/dashboard?trip=${trip.id}`}
          className="text-sm font-medium text-brand-dark underline-offset-4 hover:underline"
        >
          Open Daily Dashboard
        </Link>
        <Link
          href={`/flight-status?trip=${trip.id}`}
          className="text-sm font-medium text-brand-dark underline-offset-4 hover:underline"
        >
          Flight Status
        </Link>
      </nav>

      <header className="mt-6 mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{status}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-surface-strong">{trip.name}</h1>
          <p className="text-sm text-slate-600">
            {trip.origin} ({trip.originTimeZone}) → {trip.destination} ({trip.destinationTimeZone})
          </p>
        </div>
        <TripActions tripId={trip.id} />
      </header>

      <dl className="grid gap-4 rounded-lg border border-slate-200 bg-surface p-5 sm:grid-cols-2">
        <div className="space-y-1">
          <dt className="text-xs font-medium text-slate-500">Departure</dt>
          <dd className="text-sm text-surface-strong">
            <time dateTime={trip.departureAt.toISOString()}>
              {formatTripTime(trip.departureAt, trip.originTimeZone)}
            </time>
            <span className="block text-xs text-slate-500">{trip.originTimeZone}</span>
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-xs font-medium text-slate-500">Arrival</dt>
          <dd className="text-sm text-surface-strong">
            <time dateTime={trip.arrivalAt.toISOString()}>
              {formatTripTime(trip.arrivalAt, trip.destinationTimeZone)}
            </time>
            <span className="block text-xs text-slate-500">{trip.destinationTimeZone}</span>
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-xs font-medium text-slate-500">Journey duration</dt>
          <dd className="text-sm text-surface-strong">{duration}</dd>
        </div>
        {firstReturn && (
          <div className="space-y-1">
            <dt className="text-xs font-medium text-slate-500">Return departure</dt>
            <dd className="text-sm text-surface-strong">
              <time dateTime={firstReturn.scheduledDepartureAt.toISOString()}>
                {formatTripTime(firstReturn.scheduledDepartureAt, firstReturn.departureTimeZone)}
              </time>
              <span className="block text-xs text-slate-500">{firstReturn.departureTimeZone}</span>
            </dd>
          </div>
        )}
        {trip.notes && (
          <div className="space-y-1 sm:col-span-2">
            <dt className="text-xs font-medium text-slate-500">Notes</dt>
            <dd className="whitespace-pre-wrap text-sm text-surface-strong">{trip.notes}</dd>
          </div>
        )}
      </dl>
      <FlightPlanner
        tripId={trip.id}
        origin={trip.origin}
        destination={trip.destination}
        initialSegments={flightSegments.map((segment) => ({
          ...segment,
          scheduledDepartureAt: segment.scheduledDepartureAt.toISOString(),
          scheduledArrivalAt: segment.scheduledArrivalAt.toISOString(),
        }))}
      />
      {flightStatusNotices.map((result) => (
        <p
          key={result.leg}
          role="status"
          className={`mt-10 rounded-md border px-4 py-3 text-sm ${
            result.flightStatusAlerts.length > 0
              ? "border-danger-dark bg-danger-soft text-danger-dark"
              : "border-warning-dark bg-warning-soft text-warning-dark"
          }`}
        >
          {result.flightStatusAlerts.length > 0
            ? `A ${result.leg} flight on this trip has been cancelled or diverted.`
            : `Verified flight-status changes are not reflected in the ${RECOVERY_PLAN_LABELS[
                result.leg
              ].toLowerCase()} yet.`}{" "}
          <Link
            href={`/flight-status?trip=${trip.id}`}
            className="font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-brand"
          >
            Review flight status
          </Link>
          .
        </p>
      ))}
      <RecoveryDashboard
        key={recovery.plan?.updatedAt.toISOString() ?? "no-plan"}
        tripId={trip.id}
        leg="outbound"
        departureAt={trip.departureAt.toISOString()}
        arrivalAt={trip.arrivalAt.toISOString()}
        destinationTimeZone={trip.destinationTimeZone}
        initialPlan={recovery.plan ? toRecoveryPlanView(recovery.plan) : null}
        initialPlanIsOutOfDate={recovery.isOutOfDate}
      />
      {firstReturn && lastReturn && (
        <RecoveryDashboard
          key={`return-${returnRecovery.plan?.updatedAt.toISOString() ?? "no-plan"}`}
          tripId={trip.id}
          leg="return"
          departureAt={firstReturn.scheduledDepartureAt.toISOString()}
          arrivalAt={lastReturn.scheduledArrivalAt.toISOString()}
          destinationTimeZone={lastReturn.arrivalTimeZone}
          initialPlan={returnRecovery.plan ? toRecoveryPlanView(returnRecovery.plan) : null}
          initialPlanIsOutOfDate={returnRecovery.isOutOfDate}
        />
      )}
    </div>
  );
}
