import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  DATABASE_URL: z
    .string({ required_error: "DATABASE_URL is required" })
    .min(1, "DATABASE_URL is required")
    .regex(/^postgresql:\/\/.+$/, "DATABASE_URL must be a PostgreSQL connection string"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cachedEnv) return cachedEnv;

  const result = serverEnvSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
  });

  if (!result.success) {
    const message = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");

    throw new Error(`Invalid server environment configuration: ${message}`);
  }

  cachedEnv = result.data;
  return cachedEnv;
}

const aviationstackKeySchema = z
  .string()
  .max(200, "AVIATIONSTACK_API_KEY is too long")
  .regex(/^[A-Za-z0-9]+$/, "AVIATIONSTACK_API_KEY contains unexpected characters");

export interface FlightStatusProviderConfig {
  provider: "aviationstack";
  apiKey: string;
}

/**
 * Returns the flight-status provider configuration, or null when no provider
 * key is set. Server-only: the key must never reach client bundles or logs.
 */
export function getFlightStatusProviderConfig(): FlightStatusProviderConfig | null {
  const rawKey = process.env.AVIATIONSTACK_API_KEY?.trim();
  if (!rawKey) return null;

  const result = aviationstackKeySchema.safeParse(rawKey);
  if (!result.success) {
    // Report only the validation message, never the key value.
    throw new Error(
      `Invalid flight-status provider configuration: ${result.error.errors[0]?.message}`,
    );
  }
  return { provider: "aviationstack", apiKey: result.data };
}
