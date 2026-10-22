"use client";

import React, { FormEvent, useState } from "react";
import {
  findPlanOverlaps,
  formatActivityDuration,
  formatActivityTimeRange,
  getActivityTimes,
  type PersonalActivityView,
  type RecoveryActivityView,
} from "@lib/recoveryDashboard";
import type { PersonalActivityInput } from "@components/dashboard/personalActivityApi";

export function PersonalIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4" />
    </svg>
  );
}

export const PERSONAL_STYLE = {
  label: "Your activity",
  badge: "bg-slate-100 text-slate-700 ring-slate-300",
  accent: "border-l-slate-500",
};

function localTimes(activity: PersonalActivityView) {
  return getActivityTimes({
    scheduledAt: activity.startsAt,
    endsAt: activity.endsAt,
    timeZone: activity.timeZone,
  });
}

export function PersonalActivityForm({
  dayLabel,
  date,
  timeZone,
  initial,
  onSubmit,
  onCancel,
}: {
  dayLabel: string;
  date: string;
  timeZone: string;
  initial?: PersonalActivityView;
  onSubmit: (input: PersonalActivityInput) => Promise<void>;
  onCancel: () => void;
}) {
  const initialTimes = initial ? localTimes(initial) : null;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [startTime, setStartTime] = useState(initialTimes?.start ?? "");
  const [endTime, setEndTime] = useState(initialTimes?.end ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idPrefix = initial ? `personal-${initial.id}` : "personal-new";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (endTime <= startTime) {
      setError("The activity must end after it starts.");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ title, notes, date, startTime, endTime, timeZone });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save the activity.");
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label={initial ? `Edit ${initial.title}` : "Add your activity"}
      className="space-y-3 rounded-md border border-slate-300 bg-surface-muted p-4"
    >
      <p className="text-sm font-semibold text-surface-strong">
        {initial ? "Edit your activity" : `Add an activity to ${dayLabel}`}
      </p>
      <p className="text-xs text-slate-500">Times in {timeZone}</p>
      <div className="space-y-1">
        <label htmlFor={`${idPrefix}-title`} className="text-sm font-medium text-surface-strong">
          Title
        </label>
        <input
          id={`${idPrefix}-title`}
          required
          maxLength={120}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Client meeting"
          className="w-full rounded-md border border-slate-300 bg-surface px-3 py-2 text-sm"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor={`${idPrefix}-start`} className="text-sm font-medium text-surface-strong">
            Start time
          </label>
          <input
            id={`${idPrefix}-start`}
            type="time"
            required
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            className="w-full rounded-md border border-slate-300 bg-surface px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${idPrefix}-end`} className="text-sm font-medium text-surface-strong">
            End time
          </label>
          <input
            id={`${idPrefix}-end`}
            type="time"
            required
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
            className="w-full rounded-md border border-slate-300 bg-surface px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="space-y-1">
        <label htmlFor={`${idPrefix}-notes`} className="text-sm font-medium text-surface-strong">
          Notes (optional)
        </label>
        <textarea
          id={`${idPrefix}-notes`}
          maxLength={500}
          rows={2}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="w-full rounded-md border border-slate-300 bg-surface px-3 py-2 text-sm"
        />
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-danger-dark bg-danger-soft px-3 py-2 text-sm text-danger-dark"
        >
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving…" : initial ? "Save changes" : "Add to calendar"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-slate-200 bg-surface px-4 py-2 text-sm font-medium text-slate-700 hover:bg-surface-muted"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function PersonalEvent({
  activity,
  planActivities,
  onEdit,
  onDelete,
  disabled,
}: {
  activity: PersonalActivityView;
  /** The day's plan activities, used to point out overlaps. */
  planActivities: RecoveryActivityView[];
  onEdit: () => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  const times = localTimes(activity);
  const overlaps = findPlanOverlaps(activity, planActivities);

  return (
    <div
      className={`flex items-start gap-3 rounded-md border border-l-4 border-slate-200 bg-slate-50 p-3 ${PERSONAL_STYLE.accent}`}
    >
      <div className="w-[4.75rem] shrink-0 border-r border-slate-200 pr-3 tabular-nums">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Start</p>
        <time
          dateTime={activity.startsAt}
          className="block text-base font-semibold leading-tight text-surface-strong"
        >
          {times.start}
        </time>
        <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          End
        </p>
        <time
          dateTime={activity.endsAt}
          className="block text-base font-semibold leading-tight text-surface-strong"
        >
          {times.end}
        </time>
        {times.durationMinutes !== null && (
          <span className="mt-1.5 inline-block whitespace-nowrap rounded bg-surface px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
            {formatActivityDuration(times.durationMinutes)}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1 ${PERSONAL_STYLE.badge}`}
          >
            <PersonalIcon className="h-3.5 w-3.5" />
          </span>
          <span className="text-xs text-slate-500">{PERSONAL_STYLE.label}</span>
        </span>
        <p className="mt-1 text-sm font-semibold text-surface-strong">{activity.title}</p>
        {activity.notes && (
          <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-600">
            {activity.notes}
          </p>
        )}
        {overlaps.length > 0 && (
          <p className="mt-2 text-xs font-medium text-warning-dark">
            Overlaps with your plan:{" "}
            {overlaps
              .map((overlap) => `${overlap.title} (${formatActivityTimeRange(overlap)})`)
              .join(", ")}
          </p>
        )}
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={onEdit}
            disabled={disabled}
            aria-label={`Edit ${activity.title}`}
            className="rounded-md border border-slate-200 bg-surface px-3 py-1 text-xs font-medium text-slate-700 hover:bg-surface-muted disabled:opacity-60"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled}
            aria-label={`Delete ${activity.title}`}
            className="rounded-md border border-danger-dark px-3 py-1 text-xs font-medium text-danger-dark hover:bg-danger-soft disabled:opacity-60"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
