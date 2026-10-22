import { rejectCrossOrigin } from "@server/authApiError";

describe("account request origin validation", () => {
  it("accepts the browser host when the internal request URL uses another hostname", () => {
    const request = new Request("http://next-internal:3000/api/auth/register", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
      },
    });

    expect(rejectCrossOrigin(request)).toBeNull();
  });

  it("rejects a different browser origin", async () => {
    const request = new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "https://attacker.example",
      },
    });

    const response = rejectCrossOrigin(request);
    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual({
      error: "Cross-origin account requests are not allowed.",
    });
  });
});
