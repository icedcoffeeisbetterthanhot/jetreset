import { TripActions } from "@components/trips/TripActions";
import { computeDurationMinutes, formatDuration } from "@lib/timezone";
import { getTripById } from "@server/tripService";
import { listFlightSegments } from "@server/flightService";
import { FlightPlanner } from "@components/trips/FlightPlanner";
import { RecoveryDashboard } from "@components/trips/RecoveryDashboard";
import { getRecoveryPlan } from "@server/recoveryService";
import { toRecoveryPlanView } from "@lib/recoveryDashboard";
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
  const recovery = await getRecoveryPlan(id);

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
          Open daily dashboard
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
      <RecoveryDashboard
        tripId={trip.id}
        departureAt={trip.departureAt.toISOString()}
        arrivalAt={trip.arrivalAt.toISOString()}
        destinationTimeZone={trip.destinationTimeZone}
        initialPlan={recovery.plan ? toRecoveryPlanView(recovery.plan) : null}
        initialPlanIsOutOfDate={recovery.isOutOfDate}
      />
    </div>
  );
}
