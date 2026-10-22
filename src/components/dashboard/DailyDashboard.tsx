"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { RecoveryActivityType } from "@lib/recoveryPlan";
import {
  getDailyRecoveryState,
  getDefaultCalendarDay,
  getPlanCalendarDays,
  offsetDescription,
  type RecoveryActivityView,
  type RecoveryPlanView,
} from "@lib/recoveryDashboard";
import { updateActivityCompletion } from "@components/trips/recoveryApi";
import { ActivityIcon } from "@components/dashboard/ActivityIcon";
import { CATEGORY_STYLES, RecoveryCalendar } from "@components/dashboard/RecoveryCalendar";

interface DailyDashboardProps {
  tripId: number;
  departureAt: string;
  arrivalAt: string;
  destinationTimeZone: string;
  plan: RecoveryPlanView;
  planIsOutOfDate: boolean;
  /** Server render time, so the first client render matches the server output. */
  initialNow: string;
}

const REFRESH_INTERVAL_MS = 60_000;

function formatDateTime(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
}

function formatClock(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeStyle: "short", timeZone }).format(new Date(value));
}

export function DailyDashboard({
  tripId,
  departureAt,
  arrivalAt,
  destinationTimeZone,
  plan: initialPlan,
  planIsOutOfDate,
  initialNow,
}: DailyDashboardProps) {
  const [plan, setPlan] = useState(initialPlan);
  const [now, setNow] = useState(() => new Date(initialNow));
  const [updatingActivityId, setUpdatingActivityId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNow(new Date());
    const interval = window.setInterval(() => setNow(new Date()), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, []);

  const state = getDailyRecoveryState({
    departureAt: new Date(departureAt),
    arrivalAt: new Date(arrivalAt),
    destinationTimeZone,
    plan,
    now,
  });
  const calendarDays = useMemo(() => getPlanCalendarDays(plan), [plan]);
  const [selectedDayNumber, setSelectedDayNumber] = useState(() =>
    getDefaultCalendarDay(calendarDays, state),
  );
  const todayLabel = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeZone: destinationTimeZone,
  }).format(now);

  async function handleActivityToggle(activity: RecoveryActivityView) {
    setError(null);
    setUpdatingActivityId(activity.id);
    try {
      const updated = await updateActivityCompletion(
        tripId,
        activity.id,
        activity.completedAt === null,
      );
      setPlan((current) => ({
        ...current,
        activities: current.activities.map((item) =>
          item.id === updated.id ? { ...item, completedAt: updated.completedAt } : item,
        ),
      }));
    } catch (activityError) {
      setError(
        activityError instanceof Error
          ? activityError.message
          : "Unable to update activity progress.",
      );
    } finally {
      setUpdatingActivityId(null);
    }
  }

  const emptyDayMessage =
    state.stage === "in-transit"
      ? "You are in transit. The destination-local daily schedule begins on arrival."
      : state.stage === "complete"
        ? "The scheduled recovery-plan period has ended. Your usual routine is a reasonable default from here."
        : state.stage === "before-departure"
          ? `No preparation activities are scheduled for today. Your destination-local schedule begins after arrival on ${new Intl.DateTimeFormat(
              "en-GB",
              { dateStyle: "full", timeZone: destinationTimeZone },
            ).format(new Date(arrivalAt))}.`
          : "No activities are scheduled for today.";

  return (
    <div className="space-y-8">
      {planIsOutOfDate && (
        <p
          className="rounded-md border border-warning-dark bg-warning-soft px-4 py-3 text-sm text-warning-dark"
          role="status"
        >
          This plan was based on earlier trip details.{" "}
          <Link
            href={`/trips/${tripId}`}
            className="font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-brand"
          >
            Regenerate it from the trip page
          </Link>{" "}
          to use the current itinerary.
        </p>
      )}

      <section aria-labelledby="dashboard-overview-heading" className="space-y-4">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-dark">
            {state.stageLabel}
          </p>
          <h2 id="dashboard-overview-heading" className="text-lg font-semibold text-surface-strong">
            {todayLabel}
          </h2>
          <p className="text-xs text-slate-600">
            Destination time zone: {plan.destinationTimeZone} · Approximate change:{" "}
            {offsetDescription(plan.timeZoneChangeMinutes)}
            {plan.direction !== "none" &&
              ` · ${plan.direction === "east" ? "eastbound" : "westbound"}`}
          </p>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryTile
            icon="sleep"
            label="Next target sleep time"
            value={
              state.nextBedtime
                ? formatDateTime(state.nextBedtime.scheduledAt, state.nextBedtime.timeZone)
                : "None remaining"
            }
            detail={`Bedtime target ${plan.targetBedtime}`}
          />
          <SummaryTile
            icon="light"
            label="Next wake-time target"
            value={
              state.nextWakeTime
                ? formatDateTime(state.nextWakeTime.scheduledAt, state.nextWakeTime.timeZone)
                : "None remaining"
            }
            detail={`Wake target ${plan.targetWakeTime}`}
          />
          <SummaryTile
            icon={state.nextActivity?.type}
            label="Next activity today"
            value={
              state.nextActivity
                ? `${formatClock(state.nextActivity.scheduledAt, state.nextActivity.timeZone)} · ${state.nextActivity.title}`
                : "Nothing else planned"
            }
          />
          <div className="rounded-lg border border-slate-200 bg-surface p-4">
            <dt className="text-xs font-medium text-slate-500">Today&apos;s progress</dt>
            <dd className="mt-1 space-y-2">
              <span
                className="block text-base font-semibold text-surface-strong"
                aria-live="polite"
              >
                {state.dailyActivities.length > 0
                  ? `${state.completedCount} of ${state.dailyActivities.length} complete · ${state.progress}%`
                  : "No activities today"}
              </span>
              <span
                role="progressbar"
                aria-label="Today's activity progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={state.progress}
                className="block h-2 overflow-hidden rounded-full bg-surface-muted"
              >
                <span
                  className="block h-full rounded-full bg-accent transition-[width]"
                  style={{ width: `${state.progress}%` }}
                />
              </span>
            </dd>
          </div>
        </dl>
      </section>

      {state.dailyActivities.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 bg-surface px-4 py-4 text-sm text-slate-600">
          {emptyDayMessage}
        </p>
      )}

      {error && (
        <p
          className="rounded-md border border-danger-dark bg-danger-soft px-4 py-3 text-sm text-danger-dark"
          role="alert"
        >
          {error}
        </p>
      )}

      {selectedDayNumber !== undefined && (
        <RecoveryCalendar
          days={calendarDays}
          selectedDayNumber={selectedDayNumber}
          onSelectDay={setSelectedDayNumber}
          now={now}
          updatingActivityId={updatingActivityId}
          onToggle={(activity) => void handleActivityToggle(activity)}
        />
      )}

      <details className="rounded-lg border border-slate-200 bg-surface p-4">
        <summary className="cursor-pointer text-sm font-medium text-surface-strong">
          Assumptions and limitations
        </summary>
        <ul className="mt-3 list-inside list-disc space-y-2 text-xs leading-5 text-slate-600">
          {plan.assumptions.map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
          <li>
            Progress reflects only the activities you have marked complete. It is not a measure of
            how well you have adjusted.
          </li>
          <li>
            This general plan does not account for personal health conditions. Seek advice from a
            qualified healthcare professional if your circumstances may affect sleep, caffeine,
            light exposure, hydration, or exercise.
          </li>
        </ul>
      </details>
    </div>
  );
}

function SummaryTile({
  icon,
  label,
  value,
  detail,
}: {
  icon?: RecoveryActivityType;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-slate-200 bg-surface p-4">
      {icon && (
        <span
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md ring-1 ${CATEGORY_STYLES[icon].badge}`}
        >
          <ActivityIcon type={icon} className="h-5 w-5" />
        </span>
      )}
      <div className="min-w-0">
        <dt className="text-xs font-medium text-slate-500">{label}</dt>
        <dd className="mt-1">
          <span className="block text-base font-semibold text-surface-strong">{value}</span>
          {detail && <span className="mt-1 block text-xs text-slate-500">{detail}</span>}
        </dd>
      </div>
    </div>
  );
}
