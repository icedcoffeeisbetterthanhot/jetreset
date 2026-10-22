"use client";

import React, { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AirportSearchSelect } from "@components/trips/AirportSearchSelect";
import { calculateItinerary, getTimeZoneChangeMinutes } from "@lib/itinerary";
import { formatDuration, toLocalDateTime } from "@lib/timezone";
import type { Airport } from "@server/airportService";

interface FlightSegment {
  id: number;
  airline: string | null;
  flightNumber: string | null;
  departureAirportCode: string;
  departureAirportName: string;
  departureAirportCity: string | null;
  departureCountryCode: string | null;
  departureTimeZone: string;
  arrivalAirportCode: string;
  arrivalAirportName: string;
  arrivalAirportCity: string | null;
  arrivalCountryCode: string | null;
  arrivalTimeZone: string;
  scheduledDepartureAt: string;
  scheduledArrivalAt: string;
}

interface FlightFormState {
  airline: string;
  flightNumber: string;
  departureAirport: Airport | null;
  departureLocal: string;
  arrivalAirport: Airport | null;
  arrivalLocal: string;
}

interface FlightPlannerProps {
  tripId: number;
  origin: string;
  destination: string;
  initialSegments: FlightSegment[];
}

const emptyForm: FlightFormState = {
  airline: "",
  flightNumber: "",
  departureAirport: null,
  departureLocal: "",
  arrivalAirport: null,
  arrivalLocal: "",
};

function storedAirport(
  code: string,
  name: string,
  city: string | null,
  countryCode: string | null,
  timeZone: string,
): Airport {
  return { code, name, city, countryCode, timeZone };
}

function isFlightSegment(value: unknown): value is FlightSegment {
  if (typeof value !== "object" || value === null) return false;
  const segment = value as Record<string, unknown>;
  const isText = (field: unknown) => typeof field === "string";
  const isOptionalText = (field: unknown) => typeof field === "string" || field === null;
  return (
    typeof segment.id === "number" &&
    isOptionalText(segment.airline) &&
    isOptionalText(segment.flightNumber) &&
    isText(segment.departureAirportCode) &&
    isText(segment.departureAirportName) &&
    isOptionalText(segment.departureAirportCity) &&
    isOptionalText(segment.departureCountryCode) &&
    isText(segment.departureTimeZone) &&
    isText(segment.arrivalAirportCode) &&
    isText(segment.arrivalAirportName) &&
    isOptionalText(segment.arrivalAirportCity) &&
    isOptionalText(segment.arrivalCountryCode) &&
    isText(segment.arrivalTimeZone) &&
    isText(segment.scheduledDepartureAt) &&
    isText(segment.scheduledArrivalAt)
  );
}

function getErrorMessage(value: unknown, fallback: string): string {
  if (typeof value !== "object" || value === null) return fallback;
  const error = (value as Record<string, unknown>).error;
  return typeof error === "string" ? error : fallback;
}

function formatLocalTime(value: string | Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

function formatTimeZoneChange(minutes: number): string {
  if (minutes === 0) return "No time-zone change";
  const hours = Math.floor(Math.abs(minutes) / 60);
  const remainingMinutes = Math.abs(minutes) % 60;
  const duration = `${hours ? `${hours}h` : ""}${hours && remainingMinutes ? " " : ""}${
    remainingMinutes ? `${remainingMinutes}m` : ""
  }`;
  return `${duration} ${minutes > 0 ? "ahead" : "behind"}`;
}

async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    return getErrorMessage(await response.json(), fallback);
  } catch {
    return fallback;
  }
}

export function FlightPlanner({
  tripId,
  origin,
  destination,
  initialSegments,
}: FlightPlannerProps) {
  const router = useRouter();
  const [segments, setSegments] = useState(initialSegments);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const itinerary = calculateItinerary(segments);

  function startEditing(segment: FlightSegment) {
    setEditingId(segment.id);
    setError(null);
    setForm({
      airline: segment.airline ?? "",
      flightNumber: segment.flightNumber ?? "",
      departureAirport: storedAirport(
        segment.departureAirportCode,
        segment.departureAirportName,
        segment.departureAirportCity,
        segment.departureCountryCode,
        segment.departureTimeZone,
      ),
      departureLocal: toLocalDateTime(
        new Date(segment.scheduledDepartureAt),
        segment.departureTimeZone,
      ),
      arrivalAirport: storedAirport(
        segment.arrivalAirportCode,
        segment.arrivalAirportName,
        segment.arrivalAirportCity,
        segment.arrivalCountryCode,
        segment.arrivalTimeZone,
      ),
      arrivalLocal: toLocalDateTime(new Date(segment.scheduledArrivalAt), segment.arrivalTimeZone),
    });
  }

  function cancelEditing() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!form.departureAirport || !form.arrivalAirport) {
      setError("Select both a departure and arrival airport from the search results.");
      return;
    }

    setSaving(true);
    const url = editingId
      ? `/api/trips/${tripId}/flights/${editingId}`
      : `/api/trips/${tripId}/flights`;
    try {
      const response = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          airline: form.airline,
          flightNumber: form.flightNumber,
          departureAirportCode: form.departureAirport.code,
          departureLocal: form.departureLocal,
          arrivalAirportCode: form.arrivalAirport.code,
          arrivalLocal: form.arrivalLocal,
        }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Unable to save flight."));
      const savedSegment: unknown = await response.json();
      if (!isFlightSegment(savedSegment)) {
        throw new Error("The server returned invalid flight data.");
      }
      const normalizedSegment: FlightSegment = {
        ...savedSegment,
        scheduledDepartureAt: new Date(savedSegment.scheduledDepartureAt).toISOString(),
        scheduledArrivalAt: new Date(savedSegment.scheduledArrivalAt).toISOString(),
      };
      setSegments((current) =>
        editingId
          ? current.map((segment) =>
              segment.id === normalizedSegment.id ? normalizedSegment : segment,
            )
          : [...current, normalizedSegment],
      );
      cancelEditing();
      // Re-render server data (flight status, plan staleness) that depends on segments.
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save flight.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(segmentId: number) {
    if (!window.confirm("Delete this flight segment?")) return;
    setDeletingId(segmentId);
    setError(null);
    try {
      const response = await fetch(`/api/trips/${tripId}/flights/${segmentId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(await readApiError(response, "Unable to delete flight."));
      setSegments((current) => current.filter((segment) => segment.id !== segmentId));
      if (editingId === segmentId) cancelEditing();
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete flight.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section aria-labelledby="flight-itinerary-heading" className="mt-10 space-y-5">
      <header className="space-y-1">
        <h2 id="flight-itinerary-heading" className="text-xl font-semibold text-surface-strong">
          Flight itinerary
        </h2>
        <p className="text-sm text-slate-600">
          Search scheduled-service airports and add flights in their local airport times.
        </p>
      </header>

      {itinerary.segments.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-surface p-5 text-sm text-slate-600">
          No flights added yet. Add a flight segment to plan a direct or connecting journey.
        </p>
      ) : (
        <>
          <dl className="grid gap-3 rounded-lg border border-slate-200 bg-surface p-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-medium text-slate-500">Total flight time</dt>
              <dd className="text-sm font-semibold text-surface-strong">
                {formatDuration(Math.round(itinerary.flightMinutes))}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Elapsed journey</dt>
              <dd className="text-sm font-semibold text-surface-strong">
                {formatDuration(Math.round(itinerary.elapsedMinutes))}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500">Connecting layovers</dt>
              <dd className="text-sm font-semibold text-surface-strong">
                {formatDuration(Math.round(itinerary.layoverMinutes))}
              </dd>
            </div>
          </dl>
          {itinerary.warnings.length > 0 && (
            <div
              className="rounded-md border border-warning-dark bg-warning-soft px-4 py-3 text-sm text-warning-dark"
              role="status"
            >
              <p className="font-medium">Review this itinerary</p>
              <ul className="mt-1 list-inside list-disc">
                {itinerary.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          <ol className="space-y-3">
            {itinerary.segments.map((segment, index) => {
              const timezoneChange = getTimeZoneChangeMinutes(segment);
              const nextSegment = itinerary.segments[index + 1];
              const layoverMinutes = nextSegment
                ? (new Date(nextSegment.scheduledDepartureAt).getTime() -
                    new Date(segment.scheduledArrivalAt).getTime()) /
                  60000
                : null;
              const validConnection =
                nextSegment &&
                segment.arrivalAirportCode === nextSegment.departureAirportCode &&
                layoverMinutes !== null &&
                layoverMinutes >= 0;

              return (
                <li key={segment.id} className="rounded-lg border border-slate-200 bg-surface p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-slate-500">
                          {segment.airline ?? "Airline not specified"}
                          {segment.flightNumber ? ` · ${segment.flightNumber}` : ""}
                        </p>
                        <p className="text-sm font-semibold text-surface-strong">
                          {segment.departureAirportCode} → {segment.arrivalAirportCode}
                        </p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-medium text-slate-500">Departure</p>
                          <p className="text-sm text-surface-strong">
                            {formatLocalTime(
                              segment.scheduledDepartureAt,
                              segment.departureTimeZone,
                            )}
                          </p>
                          <p className="text-xs text-slate-500">
                            {segment.departureAirportName}
                            {segment.departureAirportCity
                              ? `, ${segment.departureAirportCity}`
                              : ""}
                          </p>
                          <p className="text-xs text-slate-500">{segment.departureTimeZone}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-500">Arrival</p>
                          <p className="text-sm text-surface-strong">
                            {formatLocalTime(segment.scheduledArrivalAt, segment.arrivalTimeZone)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {segment.arrivalAirportName}
                            {segment.arrivalAirportCity ? `, ${segment.arrivalAirportCity}` : ""}
                          </p>
                          <p className="text-xs text-slate-500">{segment.arrivalTimeZone}</p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600">
                        Flight time:{" "}
                        {formatDuration(
                          Math.round(
                            (new Date(segment.scheduledArrivalAt).getTime() -
                              new Date(segment.scheduledDepartureAt).getTime()) /
                              60000,
                          ),
                        )}{" "}
                        · Time-zone change: {formatTimeZoneChange(timezoneChange)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => startEditing(segment)}
                        className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-surface-muted"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(segment.id)}
                        disabled={deletingId === segment.id}
                        className="rounded-md border border-danger-dark px-3 py-2 text-sm font-medium text-danger-dark hover:bg-danger-soft disabled:opacity-60"
                      >
                        {deletingId === segment.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                  {validConnection && (
                    <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-600">
                      Layover at {segment.arrivalAirportCode}:{" "}
                      {formatDuration(Math.round(layoverMinutes))}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}

      {error && (
        <p
          className="rounded-md border border-danger-dark bg-danger-soft px-4 py-3 text-sm text-danger-dark"
          role="alert"
        >
          {error}
        </p>
      )}
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border border-slate-200 bg-surface p-5"
      >
        <h3 className="text-base font-semibold text-surface-strong">
          {editingId ? "Edit flight segment" : "Add a flight segment"}
        </h3>
        <p className="text-xs text-slate-600">
          Trip route: {origin} → {destination}. Flight times are saved as scheduled times; live
          status is not available.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="flight-airline" className="text-sm font-medium text-surface-strong">
              Airline (optional)
            </label>
            <input
              id="flight-airline"
              value={form.airline}
              onChange={(event) =>
                setForm((current) => ({ ...current, airline: event.target.value }))
              }
              maxLength={120}
              className="w-full rounded-md border border-slate-300 bg-surface px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="flight-number" className="text-sm font-medium text-surface-strong">
              Flight number (optional)
            </label>
            <input
              id="flight-number"
              value={form.flightNumber}
              onChange={(event) =>
                setForm((current) => ({ ...current, flightNumber: event.target.value }))
              }
              maxLength={32}
              className="w-full rounded-md border border-slate-300 bg-surface px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <AirportSearchSelect
            id="flight-departure-airport"
            label="Departure airport"
            value={form.departureAirport}
            onChange={(airport) =>
              setForm((current) => ({ ...current, departureAirport: airport }))
            }
            error={error && !form.departureAirport ? "Select a departure airport." : undefined}
          />
          <div className="space-y-1">
            <label
              htmlFor="flight-departure-local"
              className="text-sm font-medium text-surface-strong"
            >
              Scheduled departure (local time)<span className="text-danger">*</span>
            </label>
            <input
              id="flight-departure-local"
              required
              type="datetime-local"
              value={form.departureLocal}
              onChange={(event) =>
                setForm((current) => ({ ...current, departureLocal: event.target.value }))
              }
              className="w-full rounded-md border border-slate-300 bg-surface px-3 py-2 text-sm"
            />
            {form.departureAirport && (
              <p className="text-xs text-slate-500">{form.departureAirport.timeZone}</p>
            )}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <AirportSearchSelect
            id="flight-arrival-airport"
            label="Arrival airport"
            value={form.arrivalAirport}
            onChange={(airport) => setForm((current) => ({ ...current, arrivalAirport: airport }))}
            error={error && !form.arrivalAirport ? "Select an arrival airport." : undefined}
          />
          <div className="space-y-1">
            <label
              htmlFor="flight-arrival-local"
              className="text-sm font-medium text-surface-strong"
            >
              Scheduled arrival (local time)<span className="text-danger">*</span>
            </label>
            <input
              id="flight-arrival-local"
              required
              type="datetime-local"
              value={form.arrivalLocal}
              onChange={(event) =>
                setForm((current) => ({ ...current, arrivalLocal: event.target.value }))
              }
              className="w-full rounded-md border border-slate-300 bg-surface px-3 py-2 text-sm"
            />
            {form.arrivalAirport && (
              <p className="text-xs text-slate-500">{form.arrivalAirport.timeZone}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving…" : editingId ? "Save flight changes" : "Add flight"}
          </button>
          {editingId !== null && (
            <button
              type="button"
              onClick={cancelEditing}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-surface-muted"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
