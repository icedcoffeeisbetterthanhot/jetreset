import { NextResponse } from "next/server";
import { TripInputError, TripNotFoundError } from "@server/tripService";

export function tripApiErrorResponse(error: unknown, fallbackMessage: string) {
  if (error instanceof TripInputError || error instanceof SyntaxError) {
    return NextResponse.json(
      {
        error: error instanceof TripInputError ? error.message : "Request body must be valid JSON.",
      },
      { status: 400 },
    );
  }

  if (error instanceof TripNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
