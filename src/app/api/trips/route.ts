import { NextRequest, NextResponse } from "next/server";
import { createTrip, listTrips } from "@server/tripService";
import { tripApiErrorResponse } from "@server/tripApiError";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const trips = await listTrips();
    return NextResponse.json(trips);
  } catch (error) {
    return tripApiErrorResponse(error, "Unable to load trips.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const trip = await createTrip(body);
    return NextResponse.json({ id: trip.id }, { status: 201 });
  } catch (error) {
    return tripApiErrorResponse(error, "Unable to save trip.");
  }
}
