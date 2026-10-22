import { NextResponse } from "next/server";
import { AuthConflictError, AuthInputError, AuthRequiredError } from "@server/authErrors";

export function authApiErrorResponse(
  error: unknown,
  fallback = "Unable to complete the account request.",
) {
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (error instanceof AuthInputError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof AuthConflictError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof AuthRequiredError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  console.error("Account request failed:", error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export function rejectCrossOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  try {
    const requestUrl = new URL(request.url);
    const host = request.headers.get("host");
    const expectedOrigin = host ? `${requestUrl.protocol}//${host}` : requestUrl.origin;
    if (new URL(origin).origin !== new URL(expectedOrigin).origin) {
      return NextResponse.json(
        { error: "Cross-origin account requests are not allowed." },
        { status: 403 },
      );
    }
  } catch {
    return NextResponse.json({ error: "Request origin is invalid." }, { status: 403 });
  }
  return null;
}
