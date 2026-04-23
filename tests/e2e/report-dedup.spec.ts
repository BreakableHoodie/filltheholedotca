import { test, expect } from "@playwright/test";

// Coordinates well inside Waterloo Region (near Kitchener centre)
const BASE_LAT = 43.45;
const BASE_LNG = -80.49;

// 20 m north ≈ 0.00018° at this latitude — inside the 25 m merge radius
const OFFSET_NEAR = 0.00018;

// 40 m north ≈ 0.00036° — outside the 25 m merge radius
const OFFSET_FAR = 0.00036;

test.describe("Report API — 25 m merge deduplication", () => {
  test.beforeEach(async ({ request }) => {
    await request.delete("/api/report"); // clear fixture pothole store
  });

  test("two reports within 25 m are merged into the same pothole", async ({
    request,
  }) => {
    const r1 = await request.post("/api/report", {
      data: {
        lat: BASE_LAT,
        lng: BASE_LNG,
        address: "First report",
        description: "Minor damage",
      },
    });
    expect(r1.status()).toBe(200);
    const d1 = await r1.json();
    expect(d1.id).toBeTruthy();
    expect(d1.confirmed).toBe(false);

    const r2 = await request.post("/api/report", {
      data: {
        lat: BASE_LAT + OFFSET_NEAR,
        lng: BASE_LNG,
        address: "Second report",
        description: "Minor damage",
      },
    });
    expect(r2.status()).toBe(200);
    const d2 = await r2.json();

    // Second confirmation pushes the same pothole live
    expect(d2.id).toBe(d1.id);
    expect(d2.confirmed).toBe(true);
  });

  test("two reports more than 25 m apart are distinct potholes", async ({
    request,
  }) => {
    const r1 = await request.post("/api/report", {
      data: { lat: BASE_LAT, lng: BASE_LNG, description: "Minor damage" },
    });
    expect(r1.status()).toBe(200);
    const d1 = await r1.json();

    const r2 = await request.post("/api/report", {
      data: {
        lat: BASE_LAT + OFFSET_FAR,
        lng: BASE_LNG,
        description: "Minor damage",
      },
    });
    expect(r2.status()).toBe(200);
    const d2 = await r2.json();

    expect(d2.id).not.toBe(d1.id);
    expect(d2.confirmed).toBe(false);
  });

  test("three consecutive reports within 25 m produce one confirmed pothole", async ({
    request,
  }) => {
    const post = (offset: number) =>
      request.post("/api/report", {
        data: {
          lat: BASE_LAT + offset,
          lng: BASE_LNG,
          description: "Moderate damage",
        },
      });

    const d1 = await (await post(0)).json();
    const d2 = await (await post(0.00005)).json(); // ~5 m away
    const d3 = await (await post(0.0001)).json(); // ~11 m away

    expect(d2.id).toBe(d1.id);
    expect(d3.id).toBe(d1.id);
    // After 2 confirmations, pothole is marked confirmed
    expect(d2.confirmed).toBe(true);
  });

  test("report outside Waterloo Region geofence is rejected with 422", async ({
    request,
  }) => {
    // Toronto coordinates — outside the geofence
    const r = await request.post("/api/report", {
      data: { lat: 43.65, lng: -79.38, description: "Minor damage" },
    });
    expect(r.status()).toBe(422);
  });

  test("report at geofence boundary inside region is accepted", async ({
    request,
  }) => {
    // Exactly at latMin (43.32) — inside edge
    const r = await request.post("/api/report", {
      data: {
        lat: 43.32,
        lng: BASE_LNG,
        description: "Minor damage",
      },
    });
    expect(r.status()).toBe(200);
  });

  test("invalid JSON body returns 400", async ({ request }) => {
    const r = await request.post("/api/report", {
      headers: { "Content-Type": "application/json" },
      data: "not-json",
    });
    expect(r.status()).toBe(400);
  });
});
