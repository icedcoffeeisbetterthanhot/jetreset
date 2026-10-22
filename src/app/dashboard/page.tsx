import { DailyDashboard } from "@components/dashboard/DailyDashboard";
import {
  EmptyState,
  TripSelectForm,
  TripSummaryCard,
  secondaryLinkClass,
  selectTripFromSearchParam,
} from "@components/trips/TripSelection";
import {
  JOURNEY_LEGS,
  RECOVERY_PLAN_LABELS,
  parseJourneyLeg,
  type JourneyLeg,
} from "@lib/journeyLeg";
import { toRecoveryPlanView } from "@lib/recoveryDashboard";
import { getRecoveryPlan, listDashboardTrips } from "@server/recoveryService";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Daily Dashboard – JetReset",
};

type DashboardPageProps = {
  searchParams: Promise<{ trip?: string | string[]; leg?: string | string[] }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { trip: rawTripId, leg: rawLeg } = await searchParams;
  const trips = await listDashboardTrips();
  const now = new Date();
  const selectedTrip = selectTripFromSearchParam(rawTripId, trips, now);

  const requestedLeg = rawLeg === undefined ? undefined : parseJourneyLeg(rawLeg);
  if (requestedLeg === null) notFound();

  const plans = selectedTrip
    ? {
        outbound: await getRecoveryPlan(selectedTrip.id, "outbound"),
        return: await getRecoveryPlan(selectedTrip.id, "return"),
      }
    : null;
  // Once the return journey has started, the back-home plan is the relevant one.
  const returnPlan = plans?.return.plan;
  const defaultLeg: JourneyLeg =
    returnPlan &&
    (!plans?.outbound.plan ||
      (returnPlan.routeDepartureAt !== null && now >= returnPlan.routeDepartureAt))
      ? "return"
      : "outbound";
  const leg = requestedLeg ?? defaultLeg;
  const recovery = plans?.[leg] ?? null;
  const availableLegs = plans
    ? JOURNEY_LEGS.filter((candidate) => plans[candidate].plan || plans[candidate].hasLegFlights)
    : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-surface-strong">
            Daily Dashboard
          </h1>
          <p className="max-w-xl text-sm text-slate-600">
            Today&apos;s sleep targets, light exposure, meals, hydration, movement, and caffeine
            guidance for one trip, shown in local time where you are. This is general guidance, not
            medical advice.
          </p>
        </div>
        {trips.length > 1 && selectedTrip && (
          <TripSelectForm
            action="/dashboard"
            inputId="dashboard-trip"
            trips={trips}
            selectedTripId={selectedTrip.id}
            optionSuffix={(trip) => (trip.hasPlan ? "" : " (no plan)")}
          />
        )}
      </header>

      {!selectedTrip ? (
        <EmptyState title="No trips yet">
          <p>Create a trip, then generate a recovery plan to see daily guidance here.</p>
          <Link href="/trips/new" className={`mt-4 ${secondaryLinkClass}`}>
            Create trip
          </Link>
        </EmptyState>
      ) : (
        <div className="space-y-6">
          <TripSummaryCard trip={selectedTrip}>
            <Link href={`/flight-status?trip=${selectedTrip.id}`} className={secondaryLinkClass}>
              Flight Status
            </Link>
            <Link href={`/trips/${selectedTrip.id}`} className={secondaryLinkClass}>
              View trip and plan settings
            </Link>
          </TripSummaryCard>

          {availableLegs.length > 1 && (
            <nav aria-label="Recovery plans" className="flex flex-wrap gap-2">
              {availableLegs.map((candidate) => (
                <Link
                  key={candidate}
                  href={`/dashboard?trip=${selectedTrip.id}&leg=${candidate}`}
                  aria-current={candidate === leg ? "page" : undefined}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-brand ${
                    candidate === leg
                      ? "border-brand bg-brand text-white"
                      : "border-slate-200 bg-surface text-slate-700 hover:bg-surface-muted"
                  }`}
                >
                  {RECOVERY_PLAN_LABELS[candidate]}
                </Link>
              ))}
            </nav>
          )}

          {recovery?.plan ? (
            <DailyDashboard
              key={`${selectedTrip.id}-${leg}-${recovery.plan.updatedAt.toISOString()}`}
              tripId={selectedTrip.id}
              departureAt={(
                recovery.plan.routeDepartureAt ?? selectedTrip.departureAt
              ).toISOString()}
              arrivalAt={(recovery.plan.routeArrivalAt ?? selectedTrip.arrivalAt).toISOString()}
              destinationTimeZone={
                leg === "return"
                  ? recovery.plan.destinationTimeZone
                  : selectedTrip.destinationTimeZone
              }
              plan={toRecoveryPlanView(recovery.plan)}
              planIsOutOfDate={recovery.isOutOfDate}
              flightStatusChangePending={recovery.flightStatusChangePending}
              flightStatusAlerts={recovery.flightStatusAlerts}
              planLabel={availableLegs.length > 1 ? RECOVERY_PLAN_LABELS[leg] : undefined}
              initialNow={now.toISOString()}
            />
          ) : leg === "return" ? (
            <EmptyState title="No back-home plan for this trip">
              <p>
                {recovery?.hasLegFlights
                  ? "Generate a back-home recovery plan from the trip page to see guidance for settling back into home time."
                  : "Add your return flights on the trip page, marked as Return, then generate a back-home recovery plan."}
              </p>
              <Link href={`/trips/${selectedTrip.id}`} className={`mt-4 ${secondaryLinkClass}`}>
                Go to trip
              </Link>
            </EmptyState>
          ) : (
            <EmptyState title="No recovery plan for this trip">
              <p>
                Generate a recovery plan from the trip page to see daily sleep, light, meal,
                hydration, movement, and caffeine guidance.
              </p>
              <Link href={`/trips/${selectedTrip.id}`} className={`mt-4 ${secondaryLinkClass}`}>
                Generate a plan
              </Link>
            </EmptyState>
          )}
        </div>
      )}
    </div>
  );
}
