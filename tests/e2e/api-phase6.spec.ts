import { expect, test } from "@playwright/test";

// Schema validation tests for Phase 6 API endpoints.
// These verify zod rejects bad input before any DB interaction, so they work
// with placeholder Supabase credentials. Valid-UUID tests confirm schema
// acceptance; downstream DB errors (500, 404) are intentionally outside scope.

test.describe("Hit API (/api/hit)", () => {
  test("rejects request with missing id", async ({ request }) => {
    const response = await request.post("/api/hit", { data: {} });
    expect(response.status()).toBe(400);
  });

  test("rejects a non-UUID id", async ({ request }) => {
    const response = await request.post("/api/hit", {
      data: { id: "not-a-uuid" },
    });
    expect(response.status()).toBe(400);
  });

  test("rejects a malformed JSON body", async ({ request }) => {
    const response = await request.post("/api/hit", {
      headers: { "Content-Type": "application/json" },
      data: "not-json",
    });
    expect(response.status()).toBe(400);
  });

  test("accepts a valid UUID — zod passes, DB not exercised", async ({
    request,
  }) => {
    const response = await request.post("/api/hit", {
      data: { id: "550e8400-e29b-41d4-a716-446655440000" },
    });
    expect(response.status()).not.toBe(400);
  });
});

test.describe("Subscribe API — POST (/api/subscribe)", () => {
  test("rejects request with missing endpoint", async ({ request }) => {
    const response = await request.post("/api/subscribe", {
      data: { keys: { p256dh: "abc", auth: "xyz" } },
    });
    expect(response.status()).toBe(400);
  });

  test("rejects a non-URL endpoint", async ({ request }) => {
    const response = await request.post("/api/subscribe", {
      data: {
        endpoint: "not-a-url",
        keys: { p256dh: "abc", auth: "xyz" },
      },
    });
    expect(response.status()).toBe(400);
  });

  test("rejects endpoint exceeding 2048 characters", async ({ request }) => {
    const response = await request.post("/api/subscribe", {
      data: {
        endpoint: `https://push.example.com/${"a".repeat(2040)}`,
        keys: { p256dh: "abc", auth: "xyz" },
      },
    });
    expect(response.status()).toBe(400);
  });

  test("rejects missing keys object", async ({ request }) => {
    const response = await request.post("/api/subscribe", {
      data: { endpoint: "https://push.example.com/abc123" },
    });
    expect(response.status()).toBe(400);
  });

  test("rejects missing keys.p256dh", async ({ request }) => {
    const response = await request.post("/api/subscribe", {
      data: {
        endpoint: "https://push.example.com/abc123",
        keys: { auth: "xyz" },
      },
    });
    expect(response.status()).toBe(400);
  });

  test("rejects missing keys.auth", async ({ request }) => {
    const response = await request.post("/api/subscribe", {
      data: {
        endpoint: "https://push.example.com/abc123",
        keys: { p256dh: "abc" },
      },
    });
    expect(response.status()).toBe(400);
  });

  test("accepts a valid subscription — zod passes, DB not exercised", async ({
    request,
  }) => {
    const response = await request.post("/api/subscribe", {
      data: {
        endpoint: "https://push.example.com/abc123",
        keys: { p256dh: "dGVzdA==", auth: "dGVzdA==" },
      },
    });
    expect(response.status()).not.toBe(400);
  });
});

test.describe("Subscribe API — DELETE (/api/subscribe)", () => {
  test("rejects request with missing endpoint", async ({ request }) => {
    const response = await request.delete("/api/subscribe", { data: {} });
    expect(response.status()).toBe(400);
  });

  test("rejects a non-URL endpoint", async ({ request }) => {
    const response = await request.delete("/api/subscribe", {
      data: { endpoint: "not-a-url" },
    });
    expect(response.status()).toBe(400);
  });

  test("accepts a valid endpoint — zod passes, DB not exercised", async ({
    request,
  }) => {
    const response = await request.delete("/api/subscribe", {
      data: { endpoint: "https://push.example.com/abc123" },
    });
    expect(response.status()).not.toBe(400);
  });
});

test.describe("Embed widget (/api/embed/[id])", () => {
  test("returns 404 for an unknown pothole UUID", async ({ request }) => {
    const response = await request.get(
      "/api/embed/550e8400-e29b-41d4-a716-446655440000",
    );
    // DB returns null for unknown UUID → 404 (even without connection, data is null)
    expect(response.status()).toBe(404);
  });

  test("returns 404 for a non-UUID id (invalid DB input)", async ({
    request,
  }) => {
    const response = await request.get("/api/embed/not-a-uuid");
    expect(response.status()).toBe(404);
  });

  test("does NOT set X-Frame-Options on the embed route", async ({
    request,
  }) => {
    // The hook skips X-Frame-Options for /api/embed/* to allow iframe embedding.
    // This is intentional — even error responses should not block framing.
    const response = await request.get(
      "/api/embed/550e8400-e29b-41d4-a716-446655440000",
    );
    expect(response.headers()["x-frame-options"]).toBeUndefined();
  });
});
