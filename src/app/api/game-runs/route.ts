import { NextRequest, NextResponse } from "next/server";
import { startCloudDodgerRun } from "@server/gameService";
import { authApiErrorResponse, rejectCrossOrigin } from "@server/authApiError";

export async function POST(request: NextRequest) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  try {
    return NextResponse.json(await startCloudDodgerRun(), { status: 201 });
  } catch (error) {
    return authApiErrorResponse(error, "Unable to start a verified game run.");
  }
}
