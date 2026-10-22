import { NextRequest, NextResponse } from "next/server";
import { transferGuestTripsToAccount } from "@server/authService";
import { authApiErrorResponse, rejectCrossOrigin } from "@server/authApiError";

export async function POST(request: NextRequest) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  try {
    const body: unknown = await request.json();
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      !("confirmed" in body) ||
      body.confirmed !== true
    ) {
      return NextResponse.json({ error: "Confirm trip transfer to continue." }, { status: 400 });
    }
    const transferred = await transferGuestTripsToAccount();
    return NextResponse.json({ transferred });
  } catch (error) {
    return authApiErrorResponse(error, "Unable to transfer guest trips.");
  }
}
