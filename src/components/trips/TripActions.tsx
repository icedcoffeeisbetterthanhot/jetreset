"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export function TripActions({ tripId }: { tripId: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm("Delete this trip? This action cannot be undone.")) return;

    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/trips/${tripId}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Unable to delete trip.");
      }
      router.push("/trips");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to delete trip.");
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`/trips/${tripId}/edit`}
        className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-surface px-3 py-2 text-sm font-medium text-slate-700 hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-brand"
      >
        Edit trip
      </Link>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="inline-flex items-center justify-center rounded-md border border-danger-dark px-3 py-2 text-sm font-medium text-danger-dark hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-danger-dark"
      >
        {deleting ? "Deleting…" : "Delete trip"}
      </button>
      {error && (
        <p className="w-full text-sm text-danger-dark" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
