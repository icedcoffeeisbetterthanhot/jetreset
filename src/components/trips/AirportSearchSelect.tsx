"use client";

import React, { useEffect, useState } from "react";
import type { Airport } from "@server/airportService";

interface AirportSearchSelectProps {
  id: string;
  label: string;
  value: Airport | null;
  onChange: (airport: Airport | null) => void;
  error?: string;
}

function airportLabel(airport: Airport): string {
  return `${airport.code} — ${airport.name}${airport.city ? `, ${airport.city}` : ""}`;
}

function isAirport(value: unknown): value is Airport {
  if (typeof value !== "object" || value === null) return false;
  const airport = value as Record<string, unknown>;
  return (
    typeof airport.code === "string" &&
    typeof airport.name === "string" &&
    (typeof airport.city === "string" || airport.city === null) &&
    (typeof airport.countryCode === "string" || airport.countryCode === null) &&
    typeof airport.timeZone === "string"
  );
}

function getErrorMessage(value: unknown, fallback: string): string {
  if (typeof value !== "object" || value === null) return fallback;
  const error = (value as Record<string, unknown>).error;
  return typeof error === "string" ? error : fallback;
}

export function AirportSearchSelect({
  id,
  label,
  value,
  onChange,
  error,
}: AirportSearchSelectProps) {
  const [query, setQuery] = useState(value ? airportLabel(value) : "");
  const [options, setOptions] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (value) setQuery(airportLabel(value));
  }, [value]);

  useEffect(() => {
    const searchTerm = query.trim();
    if (value || searchTerm.length < 2) {
      setOptions([]);
      setSearchError(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setSearchError(null);
      try {
        const response = await fetch(`/api/airports?q=${encodeURIComponent(searchTerm)}`, {
          signal: controller.signal,
        });
        const data: unknown = await response.json();
        if (!response.ok) {
          throw new Error(getErrorMessage(data, "Airport search is unavailable."));
        }
        if (
          typeof data !== "object" ||
          data === null ||
          !("airports" in data) ||
          !Array.isArray(data.airports) ||
          !data.airports.every(isAirport)
        ) {
          throw new Error("Airport search returned invalid data.");
        }
        setOptions(data.airports);
      } catch (error) {
        if (controller.signal.aborted) return;
        setSearchError(error instanceof Error ? error.message : "Airport search is unavailable.");
        setOptions([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, value]);

  function handleQueryChange(nextQuery: string) {
    setQuery(nextQuery);
    if (value) onChange(null);
  }

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium text-surface-strong">
        {label}
        <span className="text-danger">*</span>
      </label>
      <input
        id={id}
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={options.length > 0}
        aria-controls={`${id}-options`}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        autoComplete="off"
        value={query}
        onChange={(event) => handleQueryChange(event.target.value)}
        className="w-full rounded-md border border-slate-300 bg-surface px-3 py-2 text-sm text-surface-strong"
        placeholder="Search airport, city, or IATA code"
      />
      {loading && <p className="text-xs text-slate-500">Searching airports…</p>}
      {searchError && (
        <p className="text-xs text-danger-dark" role="alert">
          {searchError}
        </p>
      )}
      {options.length > 0 && (
        <ul
          id={`${id}-options`}
          role="listbox"
          className="max-h-56 overflow-y-auto rounded-md border border-slate-200 bg-surface shadow-soft"
        >
          {options.map((airport) => (
            <li key={airport.code} role="option" aria-selected={false}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-brand"
                onClick={() => {
                  onChange(airport);
                  setQuery(airportLabel(airport));
                  setOptions([]);
                }}
              >
                <span className="font-medium">{airport.code}</span>
                <span> — {airport.name}</span>
                {airport.city && <span className="text-slate-500">, {airport.city}</span>}
                <span className="block text-xs text-slate-500">
                  {airport.countryCode ?? "Country unavailable"} · {airport.timeZone}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim().length >= 2 && !loading && options.length === 0 && !searchError && !value && (
        <p className="text-xs text-slate-500">No matching scheduled-service airport found.</p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs text-danger-dark">
          {error}
        </p>
      )}
      {value && <p className="text-xs text-slate-500">Time zone: {value.timeZone}</p>}
    </div>
  );
}
