function apiError(value: unknown, fallback: string): string {
  if (typeof value !== "object" || value === null) return fallback;
  const error = (value as Record<string, unknown>).error;
  return typeof error === "string" ? error : fallback;
}

export async function readResponseError(response: Response, fallback: string): Promise<string> {
  try {
    return apiError(await response.json(), fallback);
  } catch {
    return fallback;
  }
}

/** Persists an activity's completion state and returns the stored result. */
export async function updateActivityCompletion(
  tripId: number,
  activityId: number,
  completed: boolean,
): Promise<{ id: number; completedAt: string | null }> {
  const response = await fetch(`/api/trips/${tripId}/recovery/activities/${activityId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ completed }),
  });
  if (!response.ok) {
    throw new Error(await readResponseError(response, "Unable to update activity progress."));
  }
  const updated: unknown = await response.json();
  if (
    typeof updated !== "object" ||
    updated === null ||
    !("id" in updated) ||
    typeof updated.id !== "number" ||
    !("completedAt" in updated) ||
    !(updated.completedAt === null || typeof updated.completedAt === "string")
  ) {
    throw new Error("The server returned invalid activity progress.");
  }
  return { id: updated.id, completedAt: updated.completedAt };
}
