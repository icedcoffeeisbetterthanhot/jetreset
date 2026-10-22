import { z } from "zod";

/** The two halves of a round trip. Outbound is the default for one-way trips. */
export const JOURNEY_LEGS = ["outbound", "return"] as const;
export type JourneyLeg = (typeof JOURNEY_LEGS)[number];

export const journeyLegSchema = z.enum(JOURNEY_LEGS);

export const JOURNEY_LEG_LABELS: Record<JourneyLeg, string> = {
  outbound: "Outbound",
  return: "Return",
};

export const RECOVERY_PLAN_LABELS: Record<JourneyLeg, string> = {
  outbound: "Arrival recovery plan",
  return: "Back-home recovery plan",
};

/** Reads an optional `leg` value (query or body), defaulting to outbound. */
export function parseJourneyLeg(value: unknown): JourneyLeg | null {
  if (value === undefined || value === null || value === "") return "outbound";
  const parsed = journeyLegSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Keeps only the segments that belong to one leg. */
export function segmentsForLeg<T extends { leg: JourneyLeg }>(segments: T[], leg: JourneyLeg): T[] {
  return segments.filter((segment) => segment.leg === leg);
}
