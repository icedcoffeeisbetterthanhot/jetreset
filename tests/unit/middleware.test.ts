import { NextRequest } from "next/server";
import { middleware } from "../../src/middleware";

describe("guest session middleware", () => {
  it("forwards a new guest identity to the current request and sets its cookie", () => {
    const request = new NextRequest("http://localhost:3000/trips");

    const response = middleware(request);
    const requestCookieHeader = response.headers.get("x-middleware-request-cookie");
    const guestCookie = response.cookies.get("jetreset_guest");

    expect(requestCookieHeader).toMatch(/jetreset_guest=[a-f0-9]{64}/);
    expect(guestCookie?.value).toMatch(/^[a-f0-9]{64}$/);
    expect(requestCookieHeader).toContain(guestCookie?.value);
    expect(guestCookie?.httpOnly).toBe(true);
  });

  it("does not replace an existing valid guest identity", () => {
    const guestId = "a".repeat(64);
    const request = new NextRequest("http://localhost:3000/trips", {
      headers: { cookie: `jetreset_guest=${guestId}` },
    });

    const response = middleware(request);

    expect(response.cookies.get("jetreset_guest")).toBeUndefined();
    expect(response.headers.get("x-middleware-override-headers")).toBeNull();
  });
});
