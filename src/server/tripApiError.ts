import { NextResponse } from "next/server";
import { TripInputError, TripNotFoundError } from "@server/tripService";
import { FlightSegmentNotFoundError } from "@server/flightErrors";
import { RecoveryActivityNotFoundError } from "@server/recoveryErrors";
import { PersonalActivityNotFoundError } from "@server/personalActivityErrors";
import {
  FlightStatusNotConfiguredError,
  FlightStatusPlanConflictError,
} from "@server/flightStatusErrors";

export function tripApiErrorResponse(error: unknown, fallbackMessage: string) {
  if (error instanceof TripInputError || error instanceof SyntaxError) {
    return NextResponse.json(
      {
        error: error instanceof TripInputError ? error.message : "Request body must be valid JSON.",
      },
      { status: 400 },
    );
  }

  if (
    error instanceof TripNotFoundError ||
    error instanceof FlightSegmentNotFoundError ||
    error instanceof RecoveryActivityNotFoundError ||
    error instanceof PersonalActivityNotFoundError
  ) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  if (error instanceof FlightStatusNotConfiguredError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }

  if (error instanceof FlightStatusPlanConflictError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
