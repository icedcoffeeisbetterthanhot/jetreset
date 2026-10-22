import { NextRequest, NextResponse } from "next/server";
import { authCookieOptions, getAuthCookieNames, registerAccount } from "@server/authService";
import { authApiErrorResponse, rejectCrossOrigin } from "@server/authApiError";

export async function POST(request: NextRequest) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  try {
    const guestId = request.cookies.get(getAuthCookieNames().guest)?.value;
    if (!guestId || !/^[a-f0-9]{64}$/.test(guestId)) {
      return NextResponse.json(
        { error: "Guest session is missing. Refresh and try again." },
        { status: 400 },
      );
    }
    const body = await request.json();
    const result = await registerAccount(body, guestId);
    const response = NextResponse.json(
      { user: result.user, guestTripCount: result.guestTripCount },
      { status: 201 },
    );
    response.cookies.set(
      getAuthCookieNames().session,
      result.sessionToken,
      authCookieOptions(result.expiresAt),
    );
    return response;
  } catch (error) {
    return authApiErrorResponse(error, "Unable to create account.");
  }
}
