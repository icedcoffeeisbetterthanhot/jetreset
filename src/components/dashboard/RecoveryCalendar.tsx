"use client";

import React from "react";
import { RECOVERY_ACTIVITY_TYPES, type RecoveryActivityType } from "@lib/recoveryPlan";
import {
  getCalendarHourSlots,
  getLocalDate,
  getLocalHour,
  formatActivityTimeRange,
  type PlanCalendarDay,
  type RecoveryActivityView,
} from "@lib/recoveryDashboard";
import { ActivityIcon } from "@components/dashboard/ActivityIcon";

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

export function RecoveryCalendar({
  days,
  selectedDayNumber,
  onSelectDay,
  now,
  updatingActivityId,
  onToggle,
}: RecoveryCalendarProps) {
  const selectedDay = days.find((day) => day.dayNumber === selectedDayNumber) ?? days[0];
  if (!selectedDay) return null;

  const isSelectedToday = selectedDay.date === getLocalDate(now, selectedDay.timeZone);
  const slots = getCalendarHourSlots(selectedDay);
  const nowHour = getLocalHour(now, selectedDay.timeZone);
  const nowLabel = formatClock(now, selectedDay.timeZone);
  const selectedCompleted = selectedDay.activities.filter(
    (activity) => activity.completedAt !== null,
  ).length;

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
                onClick={() => onSelectDay(day.dayNumber)}
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
        <header className="flex flex-col gap-1 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-semibold text-surface-strong">
            {dayLabel(selectedDay.dayNumber)} ·{" "}
            {formatDayPart(selectedDay.date, { dateStyle: "full" })}
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
        </header>

        <ol aria-label={`Schedule for ${dayLabel(selectedDay.dayNumber)}`} className="px-2 py-2">
          {isSelectedToday && nowHour < slots[0].hour && (
            <li className="py-2 pl-16">
              <NowMarker label={nowLabel} />
            </li>
          )}
          {slots.map((slot) => {
            const showNowInSlot = isSelectedToday && slot.hour === nowHour;
            const nowIndex = showNowInSlot
              ? slot.activities.findIndex(
                  (activity) => new Date(activity.scheduledAt).getTime() > now.getTime(),
                )
              : -1;
            return (
              <li
                key={slot.hour}
                className="grid grid-cols-[3.5rem_1fr] gap-2 border-t border-slate-100 first:border-t-0"
              >
                <span className="pt-2 text-right text-xs font-medium tabular-nums text-slate-400">
                  {slot.hour.toString().padStart(2, "0")}:00
                </span>
                <div className={`space-y-2 py-2 ${slot.activities.length ? "" : "min-h-6"}`}>
                  {slot.activities.map((activity, index) => (
                    <React.Fragment key={activity.id}>
                      {showNowInSlot && nowIndex === index && <NowMarker label={nowLabel} />}
                      <CalendarEvent
                        activity={activity}
                        disabled={updatingActivityId === activity.id}
                        onToggle={onToggle}
                      />
                    </React.Fragment>
                  ))}
                  {showNowInSlot && nowIndex === -1 && <NowMarker label={nowLabel} />}
                </div>
              </li>
            );
          })}
          {isSelectedToday && nowHour > slots[slots.length - 1].hour && (
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
  const time = formatClock(new Date(activity.scheduledAt), activity.timeZone);
  const timeRange = formatActivityTimeRange(activity);

  return (
    <div
      className={`flex items-start gap-3 rounded-md border border-l-4 p-3 ${style.accent} ${
        isCompleted ? "border-success-dark/20 bg-success-soft" : "border-slate-200 bg-surface"
      }`}
    >
      <span
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md ring-1 ${style.badge}`}
      >
        <ActivityIcon type={activity.type} className="h-5 w-5" />
      </span>
      <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer">
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-sm font-semibold tabular-nums text-surface-strong">
            <time dateTime={activity.scheduledAt}>{time}</time>
            {timeRange !== time && (
              <>
                <span aria-hidden="true">–</span>
                <span className="sr-only"> until </span>
                {activity.endsAt && (
                  <time dateTime={activity.endsAt}>{timeRange.slice(time.length + 1)}</time>
                )}
              </>
            )}
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
        aria-label={`${isCompleted ? "Mark incomplete" : "Mark complete"}: ${activity.title} at ${time}`}
      />
    </div>
  );
}
