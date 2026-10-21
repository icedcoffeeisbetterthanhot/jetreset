"use client";

import { useMemo, useState } from "react";
import { COMMON_TIME_ZONES } from "@lib/timezones";

interface TimezoneSelectProps {
  id: string;
  label: string;
  value: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  onChange: (value: string) => void;
}

export function TimezoneSelect({
  id,
  label,
  value,
  required,
  error,
  helperText,
  onChange,
}: TimezoneSelectProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return COMMON_TIME_ZONES;
    return COMMON_TIME_ZONES.filter((tz) => tz.toLowerCase().includes(q));
  }, [search]);

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium text-surface-strong">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>

      <input
        type="text"
        className="w-full rounded-md border border-slate-300 bg-surface px-3 py-2 text-xs text-slate-700"
        placeholder="Search time zone (e.g. Europe/London)"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <select
        id={id}
        className="mt-1 w-full rounded-md border border-slate-300 bg-surface px-3 py-2 text-sm text-surface-strong"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? `${id}-error` : helperText ? `${id}-help` : undefined}
      >
        <option value="">Select a time zone…</option>
        {filtered.map((tz) => (
          <option key={tz} value={tz}>
            {tz}
          </option>
        ))}
      </select>

      {helperText && !error && (
        <p id={`${id}-help`} className="text-xs text-slate-500">
          {helperText}
        </p>
      )}

      {error && (
        <p id={`${id}-error`} className="text-xs text-danger-dark">
          {error}
        </p>
      )}
    </div>
  );
}