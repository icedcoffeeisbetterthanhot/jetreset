import type { PersonalActivityView } from "@lib/recoveryDashboard";
import { readResponseError } from "@components/trips/recoveryApi";

export interface PersonalActivityInput {
  title: string;
  notes: string;
  /** Local date (YYYY-MM-DD) and times (HH:MM) in `timeZone`. */
  date: string;
  startTime: string;
  endTime: string;
  timeZone: string;
}

function isPersonalActivity(value: unknown): value is PersonalActivityView {
  if (typeof value !== "object" || value === null) return false;
  const activity = value as Record<string, unknown>;
  return (
    typeof activity.id === "number" &&
    typeof activity.title === "string" &&
    (activity.notes === null || typeof activity.notes === "string") &&
    typeof activity.startsAt === "string" &&
    typeof activity.endsAt === "string" &&
    typeof activity.timeZone === "string"
  );
}

/** Creates a personal activity, or updates it when `activityId` is given. */
export async function savePersonalActivity(
  tripId: number,
  input: PersonalActivityInput,
  activityId?: number,
): Promise<PersonalActivityView> {
  const response = await fetch(
    activityId
      ? `/api/trips/${tripId}/personal-activities/${activityId}`
      : `/api/trips/${tripId}/personal-activities`,
    {
      method: activityId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    throw new Error(await readResponseError(response, "Unable to save the activity."));
  }
  const saved: unknown = await response.json();
  if (!isPersonalActivity(saved)) throw new Error("The server returned an invalid activity.");
  return {
    ...saved,
    startsAt: new Date(saved.startsAt).toISOString(),
    endsAt: new Date(saved.endsAt).toISOString(),
  };
}

export async function deletePersonalActivity(tripId: number, activityId: number): Promise<void> {
  const response = await fetch(`/api/trips/${tripId}/personal-activities/${activityId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(await readResponseError(response, "Unable to delete the activity."));
  }
}
