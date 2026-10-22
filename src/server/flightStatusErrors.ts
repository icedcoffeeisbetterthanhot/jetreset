export class FlightStatusNotConfiguredError extends Error {
  constructor() {
    super("Live flight status is not configured. Set AVIATIONSTACK_API_KEY on the server.");
    this.name = "FlightStatusNotConfiguredError";
  }
}

/** The recovery plan cannot be adjusted automatically from the current flight status. */
export class FlightStatusPlanConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FlightStatusPlanConflictError";
  }
}
