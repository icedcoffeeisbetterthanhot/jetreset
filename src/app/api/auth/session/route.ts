import { NextResponse } from "next/server";
import { getRequestIdentity } from "@server/authService";
import { authApiErrorResponse } from "@server/authApiError";

export async function GET() {
  try {
    const identity = await getRequestIdentity();
    return NextResponse.json(
      identity.kind === "user"
        ? { signedIn: true, username: identity.username }
        : { signedIn: false },
    );
  } catch (error) {
    return authApiErrorResponse(error, "Unable to load account status.");
  }
}
