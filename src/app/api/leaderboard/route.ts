import { NextResponse } from "next/server";
import { getGlobalLeaderboard } from "@server/communityService";
import { authApiErrorResponse } from "@server/authApiError";

export async function GET() {
  try {
    return NextResponse.json({ entries: await getGlobalLeaderboard() });
  } catch (error) {
    return authApiErrorResponse(error, "Unable to load the leaderboard.");
  }
}
