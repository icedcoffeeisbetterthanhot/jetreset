import { NextRequest, NextResponse } from "next/server";
import { searchAirports } from "@server/airportService";

export function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length > 100) {
    return NextResponse.json(
      { error: "Airport search must be 100 characters or fewer." },
      { status: 400 },
    );
  }

  return NextResponse.json({ airports: searchAirports(query) });
}
