import { NextRequest, NextResponse } from "next/server";
import { authCookieOptions, getAuthCookieNames, logoutSession } from "@server/authService";
import { authApiErrorResponse, rejectCrossOrigin } from "@server/authApiError";

export async function POST(request: NextRequest) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  try {
    const name = getAuthCookieNames().session;
    await logoutSession(request.cookies.get(name)?.value);
    const response = NextResponse.json({ success: true });
    response.cookies.set(name, "", { ...authCookieOptions(), maxAge: 0 });
    return response;
  } catch (error) {
    return authApiErrorResponse(error, "Unable to sign out.");
  }
}
