"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { TimezoneSelect } from "@components/ui/TimezoneSelect";

interface TripFormState {
  name: string;
  origin: string;
  originTimeZone: string;
  destination: string;
  destinationTimeZone: string;
  departureLocal: string;
  arrivalLocal: string;
  notes: string;
}

interface TripFormProps {
  tripId?: number;
  initialValues?: TripFormState;
}

interface TripFormErrors {
  name?: string;
  origin?: string;
  destination?: string;
  originTimeZone?: string;
  destinationTimeZone?: string;
  departureLocal?: string;
  arrivalLocal?: string;
  notes?: string;
  general?: string;
}

async function saveTripAction(tripId: number | undefined, payload: TripFormState) {
  const response = await fetch(tripId ? `/api/trips/${tripId}` : "/api/trips", {
    method: tripId ? "PUT" : "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const message = data?.error ?? "Unable to save trip. Please check your details and try again.";
    throw new Error(message);
  }

  return response.json();
}

export function TripForm({ tripId, initialValues }: TripFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<TripFormState>({
    name: "",
    origin: "",
    originTimeZone: "",
    destination: "",
    destinationTimeZone: "",
    departureLocal: "",
    arrivalLocal: "",
    notes: "",
    ...initialValues,
  });
  const [errors, setErrors] = useState<TripFormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const handleChange =
    (field: keyof TripFormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSubmitting(true);

    try {
      await saveTripAction(tripId, form);
      router.push(tripId ? `/trips/${tripId}` : "/trips");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save trip. Please try again.";
      setErrors((prev) => ({ ...prev, general: message }));
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:px-6 md:py-16">
      <header className="mb-8 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-surface-strong">
          {tripId ? "Edit trip" : "Create trip"}
        </h1>
        <p className="text-sm text-slate-600">
          Enter your trip details, including the local departure and arrival times and their time
          zones.
        </p>
      </header>

      <form className="space-y-6" onSubmit={handleSubmit} noValidate>
        {errors.general && (
          <div className="rounded-md border border-danger-dark bg-danger-soft px-4 py-3 text-sm text-danger-dark">
            {errors.general}
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor="name" className="text-sm font-medium text-surface-strong">
            Trip name<span className="text-danger">*</span>
          </label>
          <input
            id="name"
            type="text"
            className="w-full rounded-md border border-slate-300 bg-surface px-3 py-2 text-sm text-surface-strong focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-muted"
            value={form.name}
            onChange={handleChange("name")}
            aria-invalid={Boolean(errors.name) || undefined}
            aria-describedby={errors.name ? "name-error" : undefined}
          />
          {errors.name && (
            <p id="name-error" className="text-xs text-danger-dark">
              {errors.name}
            </p>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="origin" className="text-sm font-medium text-surface-strong">
              Origin<span className="text-danger">*</span>
            </label>
            <input
              id="origin"
              type="text"
              className="w-full rounded-md border border-slate-300 bg-surface px-3 py-2 text-sm text-surface-strong"
              value={form.origin}
              onChange={handleChange("origin")}
              aria-invalid={Boolean(errors.origin) || undefined}
              aria-describedby={errors.origin ? "origin-error" : undefined}
            />
            {errors.origin && (
              <p id="origin-error" className="text-xs text-danger-dark">
                {errors.origin}
              </p>
            )}
          </div>

          <TimezoneSelect
            id="originTimeZone"
            label="Origin time zone (IANA)"
            required
            value={form.originTimeZone}
            onChange={(value) => setForm((prev) => ({ ...prev, originTimeZone: value }))}
            error={errors.originTimeZone}
            helperText="Choose the time zone that matches your departure location."
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="destination" className="text-sm font-medium text-surface-strong">
              Destination<span className="text-danger">*</span>
            </label>
            <input
              id="destination"
              type="text"
              className="w-full rounded-md border border-slate-300 bg-surface px-3 py-2 text-sm text-surface-strong"
              value={form.destination}
              onChange={handleChange("destination")}
              aria-invalid={Boolean(errors.destination) || undefined}
              aria-describedby={errors.destination ? "destination-error" : undefined}
            />
            {errors.destination && (
              <p id="destination-error" className="text-xs text-danger-dark">
                {errors.destination}
              </p>
            )}
          </div>

          <TimezoneSelect
            id="destinationTimeZone"
            label="Destination time zone (IANA)"
            required
            value={form.destinationTimeZone}
            onChange={(value) => setForm((prev) => ({ ...prev, destinationTimeZone: value }))}
            error={errors.destinationTimeZone}
            helperText="Choose the time zone that matches your arrival location."
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="departureLocal" className="text-sm font-medium text-surface-strong">
              Departure (origin local time)
              <span className="text-danger">*</span>
            </label>
            <input
              id="departureLocal"
              type="datetime-local"
              className="w-full rounded-md border border-slate-300 bg-surface px-3 py-2 text-sm text-surface-strong"
              value={form.departureLocal}
              onChange={handleChange("departureLocal")}
              aria-invalid={Boolean(errors.departureLocal) || undefined}
              aria-describedby={errors.departureLocal ? "departure-local-error" : undefined}
            />
            <p className="text-xs text-slate-500">
              This time is interpreted in the origin time zone you selected.
            </p>
            {errors.departureLocal && (
              <p id="departure-local-error" className="text-xs text-danger-dark">
                {errors.departureLocal}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="arrivalLocal" className="text-sm font-medium text-surface-strong">
              Arrival (destination local time)
              <span className="text-danger">*</span>
            </label>
            <input
              id="arrivalLocal"
              type="datetime-local"
              className="w-full rounded-md border border-slate-300 bg-surface px-3 py-2 text-sm text-surface-strong"
              value={form.arrivalLocal}
              onChange={handleChange("arrivalLocal")}
              aria-invalid={Boolean(errors.arrivalLocal) || undefined}
              aria-describedby={errors.arrivalLocal ? "arrival-local-error" : undefined}
            />
            <p className="text-xs text-slate-500">
              This time is interpreted in the destination time zone you selected.
            </p>
            {errors.arrivalLocal && (
              <p id="arrival-local-error" className="text-xs text-danger-dark">
                {errors.arrivalLocal}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="notes" className="text-sm font-medium text-surface-strong">
            Notes (optional)
          </label>
          <textarea
            id="notes"
            rows={4}
            className="w-full rounded-md border border-slate-300 bg-surface px-3 py-2 text-sm text-surface-strong"
            value={form.notes}
            onChange={handleChange("notes")}
            aria-invalid={Boolean(errors.notes) || undefined}
            aria-describedby={errors.notes ? "notes-error" : undefined}
          />
          {errors.notes && (
            <p id="notes-error" className="text-xs text-danger-dark">
              {errors.notes}
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-medium text-white shadow-soft hover:bg-brand-dark disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? "Saving…" : tripId ? "Save changes" : "Save trip"}
          </button>
          <button
            type="button"
            onClick={() => router.push(tripId ? `/trips/${tripId}` : "/trips")}
            className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-surface px-4 py-2 text-sm font-medium text-slate-700 hover:bg-surface-muted"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
