"use client";

import React from "react";
import { useState } from "react";
import Link from "next/link";
import type { TravelMetricsAirport } from "@lib/travelMetrics";

type TravelHistoryMapProps = {
  airports: TravelMetricsAirport[];
};

const MAP_WIDTH = 1000;
const MAP_HEIGHT = 500;
const MAP_PADDING = 24;

function project(longitude: number, latitude: number) {
  const usableWidth = MAP_WIDTH - MAP_PADDING * 2;
  const usableHeight = MAP_HEIGHT - MAP_PADDING * 2;
  return {
    left: MAP_PADDING + ((longitude + 180) / 360) * usableWidth,
    top: MAP_PADDING + ((90 - latitude) / 180) * usableHeight,
  };
}

export function TravelHistoryMap({ airports }: TravelHistoryMapProps) {
  const [selectedCode, setSelectedCode] = useState(airports[0]?.code ?? "");
  const selectedAirport = airports.find((airport) => airport.code === selectedCode);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div
        aria-label="Airport locations on an equirectangular world coordinate map"
        className="relative aspect-[2/1] overflow-hidden rounded-xl border border-slate-200 bg-sky-50"
        role="group"
      >
        <svg
          aria-hidden="true"
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          preserveAspectRatio="none"
        >
          <defs>
            <pattern id="map-dots" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="#cbd5e1" />
            </pattern>
          </defs>
          <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="#f0f9ff" />
          <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#map-dots)" opacity="0.55" />
          <image href="/world-land.svg" x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} />
          {[-60, -30, 0, 30, 60].map((latitude) => {
            const { top } = project(0, latitude);
            return (
              <g key={latitude}>
                <line
                  x1={MAP_PADDING}
                  x2={MAP_WIDTH - MAP_PADDING}
                  y1={top}
                  y2={top}
                  stroke="#94a3b8"
                  strokeDasharray="3 8"
                  strokeOpacity="0.6"
                />
                <text x="8" y={top + 4} fill="#64748b" fontSize="12">
                  {latitude}°
                </text>
              </g>
            );
          })}
          {[-120, -60, 0, 60, 120].map((longitude) => {
            const { left } = project(longitude, 0);
            return (
              <g key={longitude}>
                <line
                  x1={left}
                  x2={left}
                  y1={MAP_PADDING}
                  y2={MAP_HEIGHT - MAP_PADDING}
                  stroke="#94a3b8"
                  strokeDasharray="3 8"
                  strokeOpacity="0.6"
                />
                <text x={left + 5} y={MAP_HEIGHT - 7} fill="#64748b" fontSize="12">
                  {longitude}°
                </text>
              </g>
            );
          })}
        </svg>
        {airports.map((airport) => {
          const { left, top } = project(airport.longitude, airport.latitude);
          return (
            <button
              key={airport.code}
              type="button"
              aria-label={`${airport.code}, ${airport.city ?? airport.name}; ${airport.flightCount} flight${airport.flightCount === 1 ? "" : "s"}`}
              aria-pressed={selectedCode === airport.code}
              onClick={() => setSelectedCode(airport.code)}
              className={`absolute z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-[9px] font-bold shadow-sm transition hover:z-20 hover:scale-110 focus-visible:z-20 ${
                selectedCode === airport.code
                  ? "border-white bg-brand text-white ring-2 ring-brand"
                  : "border-white bg-brand-dark text-white"
              }`}
              style={{
                left: `${(left / MAP_WIDTH) * 100}%`,
                top: `${(top / MAP_HEIGHT) * 100}%`,
              }}
            >
              {airport.code}
            </button>
          );
        })}
        {airports.length === 0 && (
          <p className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md bg-white/95 px-3 py-2 text-center text-sm text-slate-600 shadow-sm">
            Completed flight locations will appear here.
          </p>
        )}
        <p className="absolute left-3 top-3 rounded bg-white/90 px-2 py-1 text-xs font-medium text-slate-600">
          Equirectangular coordinates
        </p>
      </div>

      <aside aria-live="polite" className="rounded-xl border border-slate-200 bg-surface p-4">
        {airports.length === 0 ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">
              Travel map
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Add completed flights to your trips to see airport locations plotted here.
            </p>
          </div>
        ) : selectedAirport ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">
              Selected airport
            </p>
            <h3 className="mt-2 text-lg font-semibold text-surface-strong">
              {selectedAirport.city ?? selectedAirport.name}
            </h3>
            <p className="text-sm text-slate-600">
              {selectedAirport.code}
              {selectedAirport.countryCode ? ` · ${selectedAirport.countryCode}` : ""}
            </p>
            <p className="mt-3 text-sm text-slate-600">
              {selectedAirport.flightCount} recorded flight
              {selectedAirport.flightCount === 1 ? "" : "s"}
            </p>
            <ul className="mt-4 space-y-2 border-t border-slate-200 pt-3">
              {selectedAirport.trips.map((trip) => (
                <li key={trip.id}>
                  <Link
                    href={`/trips/${trip.id}`}
                    className="text-sm font-medium text-brand-dark underline-offset-4 hover:underline"
                  >
                    {trip.name}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-slate-600">Select an airport marker to inspect its trips.</p>
        )}
      </aside>
    </div>
  );
}
