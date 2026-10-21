"use client";

import React, { FormEvent, useState } from "react";
import type { RecoveryActivityType } from "@lib/recoveryPlan";

interface RecoveryActivityView {
  id: number;
  activityKey: string;
  dayNumber: number;
  type: RecoveryActivityType;
  title: string;
  guidance: string;
  scheduledAt: string;
  timeZone: string;
  completedAt: string | null;
}

interface RecoveryPlanView {
  sourceTripUpdatedAt: string;
  destinationTimeZone: string;
  journeyDurationMinutes: number;
  direction: "east" | "west" | "none";
  timeZoneChangeMinutes: number;
  estimatedTimeZonesCrossed: number;
  recoveryDays: number;
  targetBedtime: string;
  targetWakeTime: string;
  avoidCaffeine: boolean;
  preparationDaysAvailable: number;
  assumptions: string[];
  activities: RecoveryActivityView[];
}

interface RecoveryDashboardProps {
  tripId: number;
  departureAt: string;
  arrivalAt: string;
  destinationTimeZone: string;
  initialPlan: RecoveryPlanView | null;
  initialPlanIsOutOfDate: boolean;
}

const ACTIVITY_LABELS: Record<RecoveryActivityType, string> = {
  sleep: "Sleep",
  light: "Light",
  meal: "Meal",
  hydration: "Hydration",
  exercise: "Movement",
  caffeine: "Caffeine",
};

function formatTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date);
}

function getLocalDate(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function calendarDaysBetween(start: string, end: string): number {
  const [startYear, startMonth, startDay] = start.split("-").map(Number);
  const [endYear, endMonth, endDay] = end.split("-").map(Number);
  const startDate = Date.UTC(startYear, startMonth - 1, startDay);
  const endDate = Date.UTC(endYear, endMonth - 1, endDay);
  return Math.round((endDate - startDate) / 86_400_000);
}

function offsetDescription(minutes: number): string {
  if (minutes === 0) return "No time-zone offset change";
  const hours = Math.floor(Math.abs(minutes) / 60);
  const remainingMinutes = Math.abs(minutes) % 60;
  const duration = `${hours ? `${hours}h` : ""}${hours && remainingMinutes ? " " : ""}${
    remainingMinutes ? `${remainingMinutes}m` : ""
  }`;
  return `${duration} ${minutes > 0 ? "ahead" : "behind"}`;
}

function isRecoveryPlan(value: unknown): value is RecoveryPlanView {
  if (typeof value !== "object" || value === null) return false;
  const result = value as Record<string, unknown>;
  return (
    typeof result.destinationTimeZone === "string" &&
    typeof result.recoveryDays === "number" &&
    Array.isArray(result.activities) &&
    Array.isArray(result.assumptions)
  );
}

function apiError(value: unknown, fallback: string): string {
  if (typeof value !== "object" || value === null) return fallback;
  const error = (value as Record<string, unknown>).error;
  return typeof error === "string" ? error : fallback;
}

async function readResponseError(response: Response, fallback: string): Promise<string> {
  try {
    return apiError(await response.json(), fallback);
  } catch {
    return fallback;
  }
}

export function RecoveryDashboard({
  tripId,
  departureAt,
  arrivalAt,
  destinationTimeZone,
  initialPlan,
  initialPlanIsOutOfDate,
}: RecoveryDashboardProps) {
  const [plan, setPlan] = useState(initialPlan);
  const [planIsOutOfDate, setPlanIsOutOfDate] = useState(initialPlanIsOutOfDate);
  const [targetBedtime, setTargetBedtime] = useState(initialPlan?.targetBedtime ?? "22:00");
  const [targetWakeTime, setTargetWakeTime] = useState(initialPlan?.targetWakeTime ?? "07:00");
  const [avoidCaffeine, setAvoidCaffeine] = useState(initialPlan?.avoidCaffeine ?? false);
  const [saving, setSaving] = useState(false);
  const [updatingActivityId, setUpdatingActivityId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const departure = new Date(departureAt);
  const arrival = new Date(arrivalAt);
  const today = getLocalDate(now, destinationTimeZone);
  const destinationArrivalDate = getLocalDate(arrival, destinationTimeZone);
  const isBeforeDeparture = now.getTime() < departure.getTime();
  const isInTransit = now.getTime() >= departure.getTime() && now.getTime() < arrival.getTime();
  const rawRecoveryDay = calendarDaysBetween(destinationArrivalDate, today) + 1;
  const recoveryDay = plan
    ? Math.max(1, Math.min(plan.recoveryDays, rawRecoveryDay))
    : Math.max(1, rawRecoveryDay);
  const stage = isBeforeDeparture
    ? "Before departure"
    : isInTransit
      ? "In transit"
      : rawRecoveryDay > (plan?.recoveryDays ?? 0)
        ? "Plan period complete"
        : `Recovery day ${recoveryDay} of ${plan?.recoveryDays ?? "—"}`;
  const dailyActivities = plan
    ? plan.activities.filter((activity) => {
        if (isInTransit) return false;
        if (isBeforeDeparture) {
          return (
            activity.dayNumber === 0 &&
            getLocalDate(new Date(activity.scheduledAt), activity.timeZone) ===
              getLocalDate(now, activity.timeZone)
          );
        }
        return (
          activity.dayNumber === recoveryDay &&
          getLocalDate(new Date(activity.scheduledAt), activity.timeZone) === today
        );
      })
    : [];
  const completedCount = dailyActivities.filter((activity) => activity.completedAt !== null).length;
  const nextBedtime = plan?.activities.find(
    (activity) =>
      activity.title === "Target bedtime" &&
      activity.completedAt === null &&
      new Date(activity.scheduledAt).getTime() >= now.getTime(),
  );
  const progress = dailyActivities.length
    ? Math.round((completedCount / dailyActivities.length) * 100)
    : 0;

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const response = await fetch(`/api/trips/${tripId}/recovery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetBedtime, targetWakeTime, avoidCaffeine }),
      });
      if (!response.ok) {
        throw new Error(await readResponseError(response, "Unable to generate a recovery plan."));
      }
      const result: unknown = await response.json();
      if (
        typeof result !== "object" ||
        result === null ||
        !("plan" in result) ||
        !("isOutOfDate" in result) ||
        typeof result.isOutOfDate !== "boolean" ||
        !isRecoveryPlan(result.plan)
      ) {
        throw new Error("The server returned an invalid recovery plan.");
      }
      setPlan(result.plan);
      setPlanIsOutOfDate(result.isOutOfDate);
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Unable to generate a recovery plan.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleActivityToggle(activity: RecoveryActivityView) {
    setError(null);
    setUpdatingActivityId(activity.id);
    try {
      const response = await fetch(`/api/trips/${tripId}/recovery/activities/${activity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: activity.completedAt === null }),
      });
      if (!response.ok) {
        throw new Error(await readResponseError(response, "Unable to update activity progress."));
      }
      const updated = await response.json();
      if (
        typeof updated !== "object" ||
        updated === null ||
        typeof updated.id !== "number" ||
        !(updated.completedAt === null || typeof updated.completedAt === "string")
      ) {
        throw new Error("The server returned invalid activity progress.");
      }
      setPlan((current) =>
        current
          ? {
              ...current,
              activities: current.activities.map((item) =>
                item.id === updated.id ? { ...item, completedAt: updated.completedAt } : item,
              ),
            }
          : current,
      );
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

  return (
    <section aria-labelledby="recovery-dashboard-heading" className="mt-10 space-y-5">
      <header className="space-y-1">
        <h2 id="recovery-dashboard-heading" className="text-xl font-semibold text-surface-strong">
          Recovery plan
        </h2>
        <p className="text-sm text-slate-600">
          General, flexible travel-routine guidance based on this trip. It is not medical advice or
          a clinical circadian model.
        </p>
      </header>

      <div className="rounded-lg border border-slate-200 bg-surface p-5">
        {!plan ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Generate a destination-local schedule for sleep, meals, daylight, hydration, gentle
              movement, and optional caffeine guidance.
            </p>
            <PreferencesForm
              targetBedtime={targetBedtime}
              targetWakeTime={targetWakeTime}
              avoidCaffeine={avoidCaffeine}
              disabled={saving}
              onBedtimeChange={setTargetBedtime}
              onWakeTimeChange={setTargetWakeTime}
              onAvoidCaffeineChange={setAvoidCaffeine}
              onSubmit={handleGenerate}
              submitLabel={saving ? "Generating…" : "Generate recovery plan"}
            />
          </div>
        ) : (
          <div className="space-y-5">
            {planIsOutOfDate && (
              <p
                className="rounded-md border border-warning-dark bg-warning-soft px-4 py-3 text-sm text-warning-dark"
                role="status"
              >
                This plan was based on earlier trip details. Regenerate it to use the current
                itinerary. Completed activities will be preserved where their schedule still
                matches.
              </p>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {stage}
                </p>
                <p className="mt-1 text-sm font-semibold text-surface-strong">
                  Destination time:{" "}
                  {new Intl.DateTimeFormat("en-GB", {
                    dateStyle: "full",
                    timeStyle: "short",
                    timeZone: plan.destinationTimeZone,
                  }).format(now)}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Journey duration: {Math.floor(plan.journeyDurationMinutes / 60)}h{" "}
                  {plan.journeyDurationMinutes % 60}m · Approximate time-zone change:{" "}
                  {offsetDescription(plan.timeZoneChangeMinutes)} ({plan.estimatedTimeZonesCrossed}{" "}
                  hour
                  {plan.estimatedTimeZonesCrossed === 1 ? "" : "s"} estimated)
                  {plan.direction !== "none" &&
                    ` · traveling ${plan.direction === "east" ? "eastbound" : "westbound"}`}
                </p>
              </div>
              <p className="text-xs text-slate-500">
                {plan.preparationDaysAvailable > 0
                  ? `${plan.preparationDaysAvailable} full day(s) before departure when this plan was generated`
                  : "No full day remained before departure when this plan was generated"}
              </p>
            </div>

            {nextBedtime && (
              <div className="rounded-md bg-surface-muted p-4">
                <p className="text-xs font-medium text-slate-500">Next target sleep time</p>
                <p className="text-base font-semibold text-surface-strong">
                  {formatTime(new Date(nextBedtime.scheduledAt), nextBedtime.timeZone)}
                </p>
              </div>
            )}

            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-slate-200 p-3">
                <dt className="text-xs font-medium text-slate-500">Recommended wake-time target</dt>
                <dd className="text-sm font-semibold text-surface-strong">
                  {plan.targetWakeTime} ({plan.destinationTimeZone})
                </dd>
              </div>
              <div className="rounded-md border border-slate-200 p-3">
                <dt className="text-xs font-medium text-slate-500">Target bedtime</dt>
                <dd className="text-sm font-semibold text-surface-strong">
                  {plan.targetBedtime} ({plan.destinationTimeZone})
                </dd>
              </div>
            </dl>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-surface-strong">
                  {isBeforeDeparture
                    ? `Preparation · ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: destinationTimeZone }).format(now)}`
                    : `Today · ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: destinationTimeZone }).format(now)}`}
                </h3>
                {dailyActivities.length > 0 && (
                  <p className="text-xs text-slate-600" aria-live="polite">
                    {completedCount} of {dailyActivities.length} activities complete · {progress}%
                  </p>
                )}
              </div>
              {dailyActivities.length === 0 ? (
                <p className="rounded-md border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-600">
                  {isInTransit
                    ? "You are in transit. The destination-local daily schedule begins on arrival."
                    : rawRecoveryDay > plan.recoveryDays
                      ? "The scheduled recovery-plan period has ended. You can still review the itinerary and guidance."
                      : isBeforeDeparture
                        ? "No preparation activities are scheduled for today. Your usual routine is a reasonable default."
                        : "No activities are scheduled for today."}
                </p>
              ) : (
                <ol className="space-y-2">
                  {dailyActivities.map((activity) => (
                    <li
                      key={activity.id}
                      className="flex items-start gap-3 rounded-md border border-slate-200 p-3"
                    >
                      <input
                        id={`activity-${activity.id}`}
                        type="checkbox"
                        checked={activity.completedAt !== null}
                        disabled={updatingActivityId === activity.id}
                        onChange={() => void handleActivityToggle(activity)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-brand focus-visible:ring-brand"
                        aria-label={`${activity.completedAt ? "Mark incomplete" : "Mark complete"}: ${activity.title}`}
                      />
                      <label
                        htmlFor={`activity-${activity.id}`}
                        className="min-w-0 flex-1 cursor-pointer"
                      >
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-slate-500">
                            {ACTIVITY_LABELS[activity.type]} ·{" "}
                            {new Intl.DateTimeFormat("en-GB", {
                              timeStyle: "short",
                              timeZone: activity.timeZone,
                            }).format(new Date(activity.scheduledAt))}
                          </span>
                          {activity.completedAt !== null && (
                            <span className="text-xs font-medium text-success-dark">Completed</span>
                          )}
                          {activity.completedAt === null && (
                            <span className="text-xs font-medium text-slate-500">Planned</span>
                          )}
                        </span>
                        <span
                          className={`mt-1 block text-sm font-semibold ${
                            activity.completedAt !== null
                              ? "text-slate-500 line-through"
                              : "text-surface-strong"
                          }`}
                        >
                          {activity.title}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-slate-600">
                          {activity.guidance}
                        </span>
                      </label>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <details className="rounded-md border border-slate-200 p-4">
              <summary className="cursor-pointer text-sm font-medium text-surface-strong">
                Assumptions and limitations
              </summary>
              <ul className="mt-3 list-inside list-disc space-y-2 text-xs leading-5 text-slate-600">
                {plan.assumptions.map((assumption) => (
                  <li key={assumption}>{assumption}</li>
                ))}
                <li>
                  This general plan does not account for personal health conditions. Seek advice
                  from a qualified healthcare professional if your circumstances may affect sleep,
                  caffeine, light exposure, hydration, or exercise.
                </li>
              </ul>
            </details>

            <details className="rounded-md border border-slate-200 p-4">
              <summary className="cursor-pointer text-sm font-medium text-surface-strong">
                Adjust preferences and regenerate
              </summary>
              <div className="mt-4">
                <PreferencesForm
                  targetBedtime={targetBedtime}
                  targetWakeTime={targetWakeTime}
                  avoidCaffeine={avoidCaffeine}
                  disabled={saving}
                  onBedtimeChange={setTargetBedtime}
                  onWakeTimeChange={setTargetWakeTime}
                  onAvoidCaffeineChange={setAvoidCaffeine}
                  onSubmit={handleGenerate}
                  submitLabel={saving ? "Regenerating…" : "Regenerate plan"}
                />
              </div>
            </details>
          </div>
        )}
        {error && (
          <p
            className="mt-4 rounded-md border border-danger-dark bg-danger-soft px-4 py-3 text-sm text-danger-dark"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

function PreferencesForm({
  targetBedtime,
  targetWakeTime,
  avoidCaffeine,
  disabled,
  onBedtimeChange,
  onWakeTimeChange,
  onAvoidCaffeineChange,
  onSubmit,
  submitLabel,
}: {
  targetBedtime: string;
  targetWakeTime: string;
  avoidCaffeine: boolean;
  disabled: boolean;
  onBedtimeChange: (value: string) => void;
  onWakeTimeChange: (value: string) => void;
  onAvoidCaffeineChange: (value: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="recovery-wake-time" className="text-sm font-medium text-surface-strong">
            Preferred wake-time target (05:00–11:59)
          </label>
          <input
            id="recovery-wake-time"
            type="time"
            min="05:00"
            max="11:59"
            required
            value={targetWakeTime}
            onChange={(event) => onWakeTimeChange(event.target.value)}
            className="w-full rounded-md border border-slate-300 bg-surface px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="recovery-bedtime" className="text-sm font-medium text-surface-strong">
            Preferred bedtime target (18:00–23:59)
          </label>
          <input
            id="recovery-bedtime"
            type="time"
            min="18:00"
            max="23:59"
            required
            value={targetBedtime}
            onChange={(event) => onBedtimeChange(event.target.value)}
            className="w-full rounded-md border border-slate-300 bg-surface px-3 py-2 text-sm"
          />
        </div>
      </div>
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={avoidCaffeine}
          onChange={(event) => onAvoidCaffeineChange(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-brand focus-visible:ring-brand"
        />
        <span>I prefer to avoid caffeine; do not include caffeine use guidance.</span>
      </label>
      <button
        type="submit"
        disabled={disabled}
        className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitLabel}
      </button>
    </form>
  );
}
