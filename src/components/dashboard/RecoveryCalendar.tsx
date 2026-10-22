"use client";

import React, { useState } from "react";
import { RECOVERY_ACTIVITY_TYPES, type RecoveryActivityType } from "@lib/recoveryPlan";
import {
  getCalendarHourSlots,
  getLocalDate,
  getLocalHour,
  formatActivityDuration,
  getActivityTimes,
  type PersonalActivityView,
  type PlanCalendarDay,
  type RecoveryActivityView,
} from "@lib/recoveryDashboard";
import { ActivityIcon } from "@components/dashboard/ActivityIcon";
import {
  PERSONAL_STYLE,
  PersonalActivityForm,
  PersonalEvent,
  PersonalIcon,
} from "@components/dashboard/PersonalActivities";
import type { PersonalActivityInput } from "@components/dashboard/personalActivityApi";

export const CATEGORY_STYLES: Record<
  RecoveryActivityType,
  { label: string; badge: string; accent: string }
> = {
  sleep: {
    label: "Sleep",
    badge: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    accent: "border-l-indigo-400",
  },
  light: {
    label: "Light exposure",
    badge: "bg-amber-50 text-amber-700 ring-amber-200",
    accent: "border-l-amber-400",
  },
  meal: {
    label: "Meal",
    badge: "bg-orange-50 text-orange-700 ring-orange-200",
    accent: "border-l-orange-400",
  },
  hydration: {
    label: "Hydration",
    badge: "bg-sky-50 text-sky-700 ring-sky-200",
    accent: "border-l-sky-400",
  },
  exercise: {
    label: "Exercise",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    accent: "border-l-emerald-400",
  },
  caffeine: {
    label: "Caffeine",
    badge: "bg-stone-100 text-stone-700 ring-stone-300",
    accent: "border-l-stone-400",
  },
};

interface RecoveryCalendarProps {
  days: PlanCalendarDay[];
  selectedDayNumber: number;
  onSelectDay: (dayNumber: number) => void;
  now: Date;
  updatingActivityId: number | null;
  onToggle: (activity: RecoveryActivityView) => void;
  /** The user's own activities for the trip; those on the selected day are shown. */
  personalActivities?: PersonalActivityView[];
  /** Creates (no id) or updates a personal activity; rejects with a user-facing message. */
  onSavePersonal?: (input: PersonalActivityInput, activityId?: number) => Promise<void>;
  onDeletePersonal?: (activityId: number) => Promise<void>;
}

function formatClock(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(date);
}

function formatDayPart(date: string, options: Intl.DateTimeFormatOptions): string {
  // Calendar dates are rendered at UTC noon so the label cannot shift a day.
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(
    new Date(`${date}T12:00:00Z`),
  );
}

function dayLabel(dayNumber: number): string {
  return dayNumber === 0 ? "Prep" : `Day ${dayNumber}`;
}

type SlotEntry =
  | { kind: "plan"; startsAt: string; activity: RecoveryActivityView }
  | { kind: "personal"; startsAt: string; activity: PersonalActivityView };

export function RecoveryCalendar({
  days,
  selectedDayNumber,
  onSelectDay,
  now,
  updatingActivityId,
  onToggle,
  personalActivities = [],
  onSavePersonal,
  onDeletePersonal,
}: RecoveryCalendarProps) {
  const [form, setForm] = useState<
    { mode: "add" } | { mode: "edit"; activity: PersonalActivityView } | null
  >(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [personalError, setPersonalError] = useState<string | null>(null);

  const selectedDay = days.find((day) => day.dayNumber === selectedDayNumber) ?? days[0];
  if (!selectedDay) return null;

  const canEditPersonal = Boolean(onSavePersonal && onDeletePersonal);
  const isSelectedToday = selectedDay.date === getLocalDate(now, selectedDay.timeZone);
  const slots = getCalendarHourSlots(selectedDay, personalActivities);
  const nowHour = getLocalHour(now, selectedDay.timeZone);
  const nowLabel = formatClock(now, selectedDay.timeZone);
  const selectedCompleted = selectedDay.activities.filter(
    (activity) => activity.completedAt !== null,
  ).length;
  const selectedDayLabel = formatDayPart(selectedDay.date, { dateStyle: "full" });

  async function handleSave(input: PersonalActivityInput) {
    if (!onSavePersonal) return;
    await onSavePersonal(input, form?.mode === "edit" ? form.activity.id : undefined);
    setForm(null);
  }

  async function handleDelete(activity: PersonalActivityView) {
    if (!onDeletePersonal || !window.confirm(`Delete "${activity.title}"?`)) return;
    setPersonalError(null);
    setDeletingId(activity.id);
    try {
      await onDeletePersonal(activity.id);
      if (form?.mode === "edit" && form.activity.id === activity.id) setForm(null);
    } catch (deleteError) {
      setPersonalError(
        deleteError instanceof Error ? deleteError.message : "Unable to delete the activity.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section aria-labelledby="plan-calendar-heading" className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <h2 id="plan-calendar-heading" className="text-lg font-semibold text-surface-strong">
          Plan calendar
        </h2>
        <ul aria-label="Activity types" className="flex flex-wrap gap-x-4 gap-y-2">
          {RECOVERY_ACTIVITY_TYPES.map((type) => (
            <li key={type} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-md ring-1 ${CATEGORY_STYLES[type].badge}`}
              >
                <ActivityIcon type={type} className="h-3.5 w-3.5" />
              </span>
              {CATEGORY_STYLES[type].label}
            </li>
          ))}
          <li className="flex items-center gap-1.5 text-xs text-slate-600">
            <span
              className={`inline-flex h-6 w-6 items-center justify-center rounded-md ring-1 ${PERSONAL_STYLE.badge}`}
            >
              <PersonalIcon className="h-3.5 w-3.5" />
            </span>
            {PERSONAL_STYLE.label}
          </li>
        </ul>
      </div>

      <div className="overflow-x-auto pb-1">
        <div role="group" aria-label="Plan days" className="flex min-w-max gap-2">
          {days.map((day) => {
            const isSelected = day.dayNumber === selectedDay.dayNumber;
            const isToday = day.date === getLocalDate(now, day.timeZone);
            const completed = day.activities.filter(
              (activity) => activity.completedAt !== null,
            ).length;
            return (
              <button
                key={day.dayNumber}
                type="button"
                aria-pressed={isSelected}
                aria-label={`${dayLabel(day.dayNumber)}, ${formatDayPart(day.date, {
                  dateStyle: "full",
                })}${isToday ? ", today" : ""}, ${completed} of ${day.activities.length} complete`}
                onClick={() => {
                  setForm(null);
                  onSelectDay(day.dayNumber);
                }}
                className={`flex w-20 flex-col items-center rounded-lg border px-2 py-2 text-center focus-visible:ring-2 focus-visible:ring-brand ${
                  isSelected
                    ? "border-brand bg-brand text-white"
                    : "border-slate-200 bg-surface text-surface-strong hover:bg-surface-muted"
                }`}
              >
                <span
                  className={`text-[11px] font-medium uppercase tracking-wide ${isSelected ? "text-white/80" : "text-slate-500"}`}
                >
                  {dayLabel(day.dayNumber)}
                </span>
                <span className="text-xs">{formatDayPart(day.date, { weekday: "short" })}</span>
                <span className="text-xl font-semibold leading-tight">
                  {formatDayPart(day.date, { day: "numeric" })}
                </span>
                <span className="text-[11px]">{formatDayPart(day.date, { month: "short" })}</span>
                <span
                  className={`mt-1 text-[11px] ${isSelected ? "text-white/80" : "text-slate-500"}`}
                >
                  {isToday ? "Today · " : ""}
                  {completed}/{day.activities.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-surface">
        <header className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <h3 className="text-base font-semibold text-surface-strong">
              {dayLabel(selectedDay.dayNumber)} · {selectedDayLabel}
              {isSelectedToday && (
                <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-dark">
                  Today
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500">
              {selectedCompleted} of {selectedDay.activities.length} complete · Times in{" "}
              {selectedDay.timeZone}
            </p>
          </div>
          {canEditPersonal && form === null && (
            <button
              type="button"
              onClick={() => {
                setPersonalError(null);
                setForm({ mode: "add" });
              }}
              className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-md border border-slate-300 bg-surface px-3 py-2 text-sm font-medium text-slate-700 hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-brand sm:self-auto"
            >
              <PersonalIcon className="h-4 w-4" />
              Add activity
            </button>
          )}
        </header>

        {(form || personalError) && (
          <div className="space-y-3 border-b border-slate-200 px-4 py-3">
            {personalError && (
              <p
                role="alert"
                className="rounded-md border border-danger-dark bg-danger-soft px-3 py-2 text-sm text-danger-dark"
              >
                {personalError}
              </p>
            )}
            {form && (
              <PersonalActivityForm
                key={form.mode === "edit" ? form.activity.id : "new"}
                dayLabel={selectedDayLabel}
                date={selectedDay.date}
                timeZone={form.mode === "edit" ? form.activity.timeZone : selectedDay.timeZone}
                initial={form.mode === "edit" ? form.activity : undefined}
                onSubmit={handleSave}
                onCancel={() => setForm(null)}
              />
            )}
          </div>
        )}

        <ol aria-label={`Schedule for ${dayLabel(selectedDay.dayNumber)}`} className="px-2 py-2">
          {isSelectedToday && slots.length > 0 && nowHour < slots[0].hour && (
            <li className="py-2 pl-16">
              <NowMarker label={nowLabel} />
            </li>
          )}
          {slots.map((slot) => {
            const entries: SlotEntry[] = [
              ...slot.activities.map((activity) => ({
                kind: "plan" as const,
                startsAt: activity.scheduledAt,
                activity,
              })),
              ...slot.personal.map((activity) => ({
                kind: "personal" as const,
                startsAt: activity.startsAt,
                activity,
              })),
            ].sort((first, second) => first.startsAt.localeCompare(second.startsAt));
            const showNowInSlot = isSelectedToday && slot.hour === nowHour;
            const nowIndex = showNowInSlot
              ? entries.findIndex((entry) => new Date(entry.startsAt).getTime() > now.getTime())
              : -1;
            return (
              <li
                key={slot.hour}
                className="grid grid-cols-[3.5rem_1fr] gap-2 border-t border-slate-100 first:border-t-0"
              >
                <span className="pt-2 text-right text-xs font-medium tabular-nums text-slate-400">
                  {slot.hour.toString().padStart(2, "0")}:00
                </span>
                <div className={`space-y-2 py-2 ${entries.length ? "" : "min-h-6"}`}>
                  {entries.map((entry, index) => (
                    <React.Fragment key={`${entry.kind}-${entry.activity.id}`}>
                      {showNowInSlot && nowIndex === index && <NowMarker label={nowLabel} />}
                      {entry.kind === "plan" ? (
                        <CalendarEvent
                          activity={entry.activity}
                          disabled={updatingActivityId === entry.activity.id}
                          onToggle={onToggle}
                        />
                      ) : (
                        <PersonalEvent
                          activity={entry.activity}
                          planActivities={selectedDay.activities}
                          disabled={!canEditPersonal || deletingId === entry.activity.id}
                          onEdit={() => {
                            setPersonalError(null);
                            setForm({ mode: "edit", activity: entry.activity });
                          }}
                          onDelete={() => void handleDelete(entry.activity)}
                        />
                      )}
                    </React.Fragment>
                  ))}
                  {showNowInSlot && nowIndex === -1 && <NowMarker label={nowLabel} />}
                </div>
              </li>
            );
          })}
          {isSelectedToday && slots.length > 0 && nowHour > slots[slots.length - 1].hour && (
            <li className="py-2 pl-16">
              <NowMarker label={nowLabel} />
            </li>
          )}
        </ol>
      </div>
    </section>
  );
}

function NowMarker({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold text-danger-dark">
      <span className="h-2 w-2 rounded-full bg-danger" aria-hidden="true" />
      <span>Now · {label}</span>
      <span className="h-px flex-1 bg-danger" aria-hidden="true" />
    </div>
  );
}

function CalendarEvent({
  activity,
  disabled,
  onToggle,
}: {
  activity: RecoveryActivityView;
  disabled: boolean;
  onToggle: (activity: RecoveryActivityView) => void;
}) {
  const style = CATEGORY_STYLES[activity.type];
  const isCompleted = activity.completedAt !== null;
  const inputId = `calendar-activity-${activity.id}`;
  const times = getActivityTimes(activity);

  return (
    <div
      className={`flex items-start gap-3 rounded-md border border-l-4 p-3 ${style.accent} ${
        isCompleted ? "border-success-dark/20 bg-success-soft" : "border-slate-200 bg-surface"
      }`}
    >
      <div className="w-[4.75rem] shrink-0 border-r border-slate-200 pr-3 tabular-nums">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Start</p>
        <time
          dateTime={activity.scheduledAt}
          className="block text-base font-semibold leading-tight text-surface-strong"
        >
          {times.start}
        </time>
        {times.end && activity.endsAt ? (
          <>
            <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              End
            </p>
            <time
              dateTime={activity.endsAt}
              className="block text-base font-semibold leading-tight text-surface-strong"
            >
              {times.end}
            </time>
            {times.endDayOffset > 0 && (
              <span className="block text-[10px] font-medium text-slate-500">
                {times.endDayOffset === 1 ? "next day" : `+${times.endDayOffset} days`}
              </span>
            )}
            {times.durationMinutes !== null && (
              <span className="mt-1.5 inline-block whitespace-nowrap rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                {formatActivityDuration(times.durationMinutes)}
              </span>
            )}
          </>
        ) : (
          <p className="mt-1.5 text-[10px] leading-tight text-slate-500">End time not set</p>
        )}
      </div>
      <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1 ${style.badge}`}
          >
            <ActivityIcon type={activity.type} className="h-3.5 w-3.5" />
          </span>
          <span className="text-xs text-slate-500">{style.label}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              isCompleted ? "bg-success-soft text-success-dark" : "bg-surface-muted text-slate-600"
            }`}
          >
            {isCompleted ? "Completed" : "Planned"}
          </span>
        </span>
        <span
          className={`mt-1 block text-sm font-semibold ${
            isCompleted ? "text-slate-500 line-through" : "text-surface-strong"
          }`}
        >
          {activity.title}
        </span>
        <span className="mt-1 block text-xs leading-5 text-slate-600">{activity.guidance}</span>
      </label>
      <input
        id={inputId}
        type="checkbox"
        checked={isCompleted}
        disabled={disabled}
        onChange={() => onToggle(activity)}
        className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-brand focus-visible:ring-brand"
        aria-label={`${isCompleted ? "Mark incomplete" : "Mark complete"}: ${activity.title} at ${times.start}`}
      />
    </div>
  );
}
