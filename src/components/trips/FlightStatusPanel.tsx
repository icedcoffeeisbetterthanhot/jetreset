"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  STATUS_CACHE_MINUTES,
  STATUS_CHECK_DAYS_AFTER_ARRIVAL,
  STATUS_CHECK_DAYS_BEFORE_DEPARTURE,
  type FlightStatusCode,
} from "@lib/flightStatus";
import { JOURNEY_LEG_LABELS, RECOVERY_PLAN_LABELS, type JourneyLeg } from "@lib/journeyLeg";
import { readResponseError } from "@components/trips/recoveryApi";

export interface FlightStatusSnapshotView {
  current: boolean;
  provider: string;
  lookupResult: "found" | "not_found";
  status: FlightStatusCode;
  providerScheduledDepartureAt: string | null;
  estimatedDepartureAt: string | null;
  actualDepartureAt: string | null;
  providerScheduledArrivalAt: string | null;
  estimatedArrivalAt: string | null;
  actualArrivalAt: string | null;
  providerUpdatedAt: string | null;
  fetchedAt: string;
}

export interface SegmentFlightStatusView {
  segmentId: number;
  leg: JourneyLeg;
  flightNumber: string | null;
  departureAirportCode: string;
  arrivalAirportCode: string;
  departureTimeZone: string;
  arrivalTimeZone: string;
  scheduledDepartureAt: string;
  scheduledArrivalAt: string;
  eligibility:
    | { eligible: true }
    | {
        eligible: false;
        reason: "no_flight_number" | "invalid_flight_number" | "too_early" | "too_late";
      };
  snapshot: FlightStatusSnapshotView | null;
  changes: string[];
  error: string | null;
}

export interface LegFlightStatusView {
  leg: JourneyLeg;
  hasPlan: boolean;
  recoveryPlanUpdatePending: boolean;
  blockingAlerts: string[];
}

export interface TripFlightStatusView {
  configured: boolean;
  legs: LegFlightStatusView[];
  segments: SegmentFlightStatusView[];
}

const STATUS_LABELS: Record<FlightStatusCode, { label: string; tone: string }> = {
  unknown: { label: "Status unknown", tone: "bg-surface-muted text-slate-700" },
  scheduled: { label: "Scheduled", tone: "bg-brand-soft text-brand-dark" },
  delayed: { label: "Delayed", tone: "bg-warning-soft text-warning-dark" },
  departed: { label: "Departed", tone: "bg-brand-soft text-brand-dark" },
  arrived: { label: "Arrived", tone: "bg-success-soft text-success-dark" },
  cancelled: { label: "Cancelled", tone: "bg-danger-soft text-danger-dark" },
  possibly_cancelled: { label: "May be cancelled", tone: "bg-warning-soft text-warning-dark" },
  diverted: { label: "Diverted", tone: "bg-danger-soft text-danger-dark" },
};

const INELIGIBLE_MESSAGES = {
  no_flight_number: "Add a flight number to this segment to check its status.",
  invalid_flight_number: "The flight number isn't in a recognised format (for example BA117).",
  too_early: `Status checks open ${STATUS_CHECK_DAYS_BEFORE_DEPARTURE} days before departure.`,
  too_late: `Historical flight status isn't available. Provider checks close ${STATUS_CHECK_DAYS_AFTER_ARRIVAL} days after arrival.`,
} as const;

function formatLocal(value: string | null, timeZone: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(new Date(value));
}

function isTripFlightStatusView(value: unknown): value is TripFlightStatusView {
  if (typeof value !== "object" || value === null) return false;
  const result = value as Record<string, unknown>;
  return (
    typeof result.configured === "boolean" &&
    Array.isArray(result.legs) &&
    Array.isArray(result.segments)
  );
}

export function FlightStatusPanel({
  tripId,
  initialStatus,
}: {
  tripId: number;
  initialStatus: TripFlightStatusView;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState<"check" | JourneyLeg | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const eligibleCount = status.segments.filter((segment) => segment.eligibility.eligible).length;

  async function loadStatus(method: "GET" | "POST") {
    const response = await fetch(`/api/trips/${tripId}/flight-status`, { method });
    if (!response.ok) {
      throw new Error(await readResponseError(response, "Unable to check flight status."));
    }
    const result: unknown = await response.json();
    if (!isTripFlightStatusView(result)) {
      throw new Error("The server returned an invalid flight status.");
    }
    setStatus(result);
  }

  async function handleCheck() {
    setBusy("check");
    setError(null);
    setNotice(null);
    try {
      await loadStatus("POST");
      router.refresh();
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : "Unable to check flight status.");
    } finally {
      setBusy(null);
    }
  }

  async function handleApply(leg: JourneyLeg) {
    setBusy(leg);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/trips/${tripId}/recovery/flight-status?leg=${leg}`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(
          await readResponseError(
            response,
            "Unable to update the recovery plan from flight status.",
          ),
        );
      }
      await loadStatus("GET");
      setNotice(
        `${RECOVERY_PLAN_LABELS[leg]} updated. Earlier and completed activities were kept.`,
      );
      router.refresh();
    } catch (applyError) {
      setError(
        applyError instanceof Error
          ? applyError.message
          : "Unable to update the recovery plan from flight status.",
      );
    } finally {
      setBusy(null);
    }
  }

  if (status.segments.length === 0) return null;

  return (
    <section aria-labelledby="flight-status-heading" className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 id="flight-status-heading" className="text-lg font-semibold text-surface-strong">
            Flights
          </h2>
          <p className="text-sm text-slate-600">
            {status.configured
              ? `Checked on request with Aviationstack; results are reused for ${STATUS_CACHE_MINUTES} minutes. Estimated and actual times appear only when the provider reports them.`
              : "Live flight status isn't configured on this server. Times below are your saved schedule only."}
          </p>
        </div>
        {status.configured && (
          <button
            type="button"
            onClick={() => void handleCheck()}
            disabled={busy !== null || eligibleCount === 0}
            className="shrink-0 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === "check" ? "Checking…" : "Check flight status"}
          </button>
        )}
      </header>

      {notice && (
        <p
          role="status"
          className="rounded-md border border-success-dark/30 bg-success-soft px-4 py-3 text-sm text-success-dark"
        >
          {notice}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-md border border-danger-dark bg-danger-soft px-4 py-3 text-sm text-danger-dark"
        >
          {error}
        </p>
      )}

      {status.legs.map((legStatus) => {
        const legSegments = status.segments.filter((segment) => segment.leg === legStatus.leg);
        const first = legSegments[0];
        const last = legSegments[legSegments.length - 1];
        const headingId = `flight-status-${legStatus.leg}-heading`;
        const legLabel = JOURNEY_LEG_LABELS[legStatus.leg];
        const planLabel = RECOVERY_PLAN_LABELS[legStatus.leg];
        return (
          <section key={legStatus.leg} aria-labelledby={headingId} className="space-y-3">
            <h3 id={headingId} className="text-base font-semibold text-surface-strong">
              {legLabel}
              {first && last && (
                <span className="ml-2 text-sm font-normal text-slate-500">
                  {first.departureAirportCode} → {last.arrivalAirportCode}
                </span>
              )}
            </h3>

            {legStatus.blockingAlerts.length > 0 && (
              <div
                role="alert"
                className="rounded-md border border-danger-dark bg-danger-soft px-4 py-3 text-sm text-danger-dark"
              >
                <p className="font-medium">Your {legLabel.toLowerCase()} flights need attention</p>
                <ul className="mt-1 list-inside list-disc">
                  {legStatus.blockingAlerts.map((alert) => (
                    <li key={alert}>{alert}</li>
                  ))}
                </ul>
                <p className="mt-2">
                  JetReset will not adjust your plan automatically.{" "}
                  <Link
                    href={`/trips/${tripId}`}
                    className="font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    Update your flight segments
                  </Link>{" "}
                  with your actual travel, then regenerate the recovery plan.
                </p>
              </div>
            )}

            {legStatus.hasPlan &&
              legStatus.recoveryPlanUpdatePending &&
              legStatus.blockingAlerts.length === 0 && (
                <div
                  role="status"
                  className="flex flex-col gap-3 rounded-md border border-warning-dark bg-warning-soft px-4 py-3 text-sm text-warning-dark sm:flex-row sm:items-center sm:justify-between"
                >
                  <p>
                    Verified flight-status changes affect your {planLabel.toLowerCase()}. Updating
                    recalculates future guidance only; earlier and completed activities are kept.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleApply(legStatus.leg)}
                    disabled={busy !== null}
                    className="shrink-0 rounded-md border border-warning-dark bg-surface px-3 py-2 font-medium text-warning-dark hover:bg-warning-soft focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy === legStatus.leg ? "Updating…" : `Update ${planLabel.toLowerCase()}`}
                  </button>
                </div>
              )}

            <ol className="space-y-3">
              {legSegments.map((segment) => (
                <SegmentStatusCard key={segment.segmentId} segment={segment} />
              ))}
            </ol>
          </section>
        );
      })}
    </section>
  );
}

function SegmentStatusCard({ segment }: { segment: SegmentFlightStatusView }) {
  const snapshot = segment.snapshot?.current ? segment.snapshot : null;
  const found = snapshot?.lookupResult === "found" ? snapshot : null;
  const badge = found
    ? STATUS_LABELS[found.status]
    : snapshot
      ? { label: "No provider data", tone: "bg-surface-muted text-slate-700" }
      : !segment.eligibility.eligible && segment.eligibility.reason === "too_late"
        ? { label: "Historical status unavailable", tone: "bg-surface-muted text-slate-700" }
        : null;
  const rows = [
    {
      label: "Departure",
      airport: segment.departureAirportCode,
      timeZone: segment.departureTimeZone,
      saved: segment.scheduledDepartureAt,
      providerScheduled: found?.providerScheduledDepartureAt ?? null,
      estimated: found?.estimatedDepartureAt ?? null,
      actual: found?.actualDepartureAt ?? null,
    },
    {
      label: "Arrival",
      airport: segment.arrivalAirportCode,
      timeZone: segment.arrivalTimeZone,
      saved: segment.scheduledArrivalAt,
      providerScheduled: found?.providerScheduledArrivalAt ?? null,
      estimated: found?.estimatedArrivalAt ?? null,
      actual: found?.actualArrivalAt ?? null,
    },
  ];

  return (
    <li className="space-y-3 rounded-lg border border-slate-200 bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-surface-strong">
          {segment.flightNumber ?? "No flight number"} · {segment.departureAirportCode} →{" "}
          {segment.arrivalAirportCode}
        </p>
        {badge && (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.tone}`}>
            {badge.label}
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left text-xs">
          <caption className="sr-only">
            Scheduled, estimated, and actual times for {segment.flightNumber ?? "this flight"}
          </caption>
          <thead className="text-slate-500">
            <tr>
              <th scope="col" className="py-1 pr-3 font-medium">
                Local time
              </th>
              <th scope="col" className="py-1 pr-3 font-medium">
                Your schedule
              </th>
              <th scope="col" className="py-1 pr-3 font-medium">
                Provider schedule
              </th>
              <th scope="col" className="py-1 pr-3 font-medium">
                Estimated
              </th>
              <th scope="col" className="py-1 font-medium">
                Actual
              </th>
            </tr>
          </thead>
          <tbody className="tabular-nums text-surface-strong">
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-slate-100">
                <th scope="row" className="py-1.5 pr-3 font-medium">
                  {row.label} {row.airport}
                  <span className="block font-normal text-slate-500">{row.timeZone}</span>
                </th>
                <td className="py-1.5 pr-3">{formatLocal(row.saved, row.timeZone)}</td>
                <td className="py-1.5 pr-3">{formatLocal(row.providerScheduled, row.timeZone)}</td>
                <td className="py-1.5 pr-3">{formatLocal(row.estimated, row.timeZone)}</td>
                <td className="py-1.5">{formatLocal(row.actual, row.timeZone)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {segment.changes.length > 0 && (
        <ul className="space-y-1 text-xs font-medium text-warning-dark">
          {segment.changes.map((change) => (
            <li key={change}>{change}</li>
          ))}
        </ul>
      )}

      <div className="space-y-1 text-xs text-slate-500">
        {!segment.eligibility.eligible && <p>{INELIGIBLE_MESSAGES[segment.eligibility.reason]}</p>}
        {segment.snapshot && !segment.snapshot.current && (
          <p>This segment was edited after its last status check. Check again for current data.</p>
        )}
        {snapshot?.lookupResult === "not_found" && (
          <p>
            The provider has no matching flight for this number, date, and route.
            Aviationstack&apos;s free plan only covers flights operating now, so check again on the
            day of travel.
          </p>
        )}
        {snapshot && (
          <p>
            Last checked {formatLocal(snapshot.fetchedAt, segment.departureTimeZone)} (
            {segment.departureTimeZone})
            {found?.providerUpdatedAt &&
              ` · provider updated ${formatLocal(found.providerUpdatedAt, segment.departureTimeZone)}`}
          </p>
        )}
        {segment.error && <p className="font-medium text-danger-dark">{segment.error}</p>}
      </div>
    </li>
  );
}
