import { DailyDashboard } from "@components/dashboard/DailyDashboard";
import {
  EmptyState,
  TripSelectForm,
  TripSummaryCard,
  secondaryLinkClass,
  selectTripFromSearchParam,
} from "@components/trips/TripSelection";
import { toRecoveryPlanView } from "@lib/recoveryDashboard";
import { getRecoveryPlan, listDashboardTrips } from "@server/recoveryService";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Daily Dashboard – JetReset",
};

type DashboardPageProps = {
  searchParams: Promise<{ trip?: string | string[] }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { trip: rawTripId } = await searchParams;
  const trips = await listDashboardTrips();
  const now = new Date();
  const selectedTrip = selectTripFromSearchParam(rawTripId, trips, now);
  const recovery = selectedTrip?.hasPlan ? await getRecoveryPlan(selectedTrip.id) : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-surface-strong">
            Daily Dashboard
          </h1>
          <p className="max-w-xl text-sm text-slate-600">
            Today&apos;s sleep targets, light exposure, meals, hydration, movement, and caffeine
            guidance for one trip, shown in destination-local time. This is general guidance, not
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
              Flight status
            </Link>
            <Link href={`/trips/${selectedTrip.id}`} className={secondaryLinkClass}>
              View trip and plan settings
            </Link>
          </TripSummaryCard>

          {recovery?.plan ? (
            <DailyDashboard
              key={`${selectedTrip.id}-${recovery.plan.updatedAt.toISOString()}`}
              tripId={selectedTrip.id}
              departureAt={selectedTrip.departureAt.toISOString()}
              arrivalAt={selectedTrip.arrivalAt.toISOString()}
              destinationTimeZone={selectedTrip.destinationTimeZone}
              plan={toRecoveryPlanView(recovery.plan)}
              planIsOutOfDate={recovery.isOutOfDate}
              flightStatusChangePending={recovery.flightStatusChangePending}
              flightStatusAlerts={recovery.flightStatusAlerts}
              initialNow={now.toISOString()}
            />
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
