import { NextRequest, NextResponse } from "next/server";
import { completeCloudDodgerRun } from "@server/gameService";
import { authApiErrorResponse, rejectCrossOrigin } from "@server/authApiError";

type RouteContext = { params: Promise<{ runId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  try {
    const { runId } = await context.params;
    return NextResponse.json(await completeCloudDodgerRun(runId, await request.json()));
  } catch (error) {
    return authApiErrorResponse(error, "Unable to submit the game score.");
  }
}
