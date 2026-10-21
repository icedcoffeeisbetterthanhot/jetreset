import { NextRequest, NextResponse } from "next/server";
import { createTrip } from "@server/tripService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const trip = await createTrip({
      name: String(body.name ?? ""),
      origin: String(body.origin ?? ""),
      destination: String(body.destination ?? ""),
      originTimeZone: String(body.originTimeZone ?? ""),
      destinationTimeZone: String(body.destinationTimeZone ?? ""),
      departureLocal: String(body.departureLocal ?? ""),
      arrivalLocal: String(body.arrivalLocal ?? ""),
      notes: typeof body.notes === "string" ? body.notes : undefined,
    });

    return NextResponse.json({ id: trip.id }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save trip. Please try again.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
