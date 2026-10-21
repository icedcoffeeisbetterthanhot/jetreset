import { NextResponse } from "next/server";
import { TripInputError, TripNotFoundError } from "@server/tripService";
import { FlightSegmentNotFoundError } from "@server/flightErrors";
import { RecoveryActivityNotFoundError } from "@server/recoveryErrors";

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
    error instanceof RecoveryActivityNotFoundError
  ) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
