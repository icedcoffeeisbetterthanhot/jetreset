import { NextRequest, NextResponse } from "next/server";

const GUEST_COOKIE = "jetreset_guest";

function createGuestId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function middleware(request: NextRequest) {
  const guestId = request.cookies.get(GUEST_COOKIE)?.value;
  if (guestId && /^[a-f0-9]{64}$/.test(guestId)) return NextResponse.next();

  const newGuestId = createGuestId();
  request.cookies.set(GUEST_COOKIE, newGuestId);

  const requestHeaders = new Headers(request.headers);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.cookies.set(GUEST_COOKIE, newGuestId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 180 * 24 * 60 * 60,
  });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
