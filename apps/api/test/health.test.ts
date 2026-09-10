import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { connectDB } from "../src/db/connection.js";

describe("API Health Endpoint", () => {
  const app = createApp();

  it("GET /health returns 200 with { status: 'ok' }", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});

describe("Database Connection Module", () => {
  it("throws clear error when MONGODB_URI is undefined", async () => {
    const originalUri = process.env.MONGODB_URI;
    delete process.env.MONGODB_URI;

    await expect(connectDB()).rejects.toThrow(
      "Missing required environment variable: MONGODB_URI"
    );

    process.env.MONGODB_URI = originalUri;
  });
});
