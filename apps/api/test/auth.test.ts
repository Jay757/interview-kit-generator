import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { User } from "../src/models/User.js";

const TEST_MONGODB_URI =
  process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/trao_test_auth";

describe("Authentication & Session Management", () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    process.env.MONGODB_URI = TEST_MONGODB_URI;
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }
    app = createApp();
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe("POST /auth/register", () => {
    it("successfully registers a new user with hashed password and creates session", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({
          email: "candidate@example.com",
          password: "supersecretpassword123",
        });

      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe("candidate@example.com");
      expect(res.body.user.id).toBeDefined();
      expect(res.body.user.password).toBeUndefined();

      // Cookie check
      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain("trao_session");

      // Verify stored password in DB is hashed
      const stored = await User.findOne({ email: "candidate@example.com" });
      expect(stored).not.toBeNull();
      expect(stored!.password).not.toBe("supersecretpassword123");
      expect(stored!.password.startsWith("$2")).toBe(true);
    });

    it("rejects duplicate email registration with 409", async () => {
      await request(app).post("/auth/register").send({
        email: "existing@example.com",
        password: "password12345",
      });

      const duplicateRes = await request(app).post("/auth/register").send({
        email: "existing@example.com",
        password: "password12345",
      });

      expect(duplicateRes.status).toBe(409);
      expect(duplicateRes.body.error).toBeDefined();
      expect(duplicateRes.body.error.code).toBe("EMAIL_ALREADY_EXISTS");
    });

    it("rejects invalid email formats", async () => {
      const res = await request(app).post("/auth/register").send({
        email: "not-an-email",
        password: "password12345",
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_INPUT");
    });

    it("rejects passwords shorter than 8 characters", async () => {
      const res = await request(app).post("/auth/register").send({
        email: "valid@example.com",
        password: "short",
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_INPUT");
    });
  });

  describe("POST /auth/login", () => {
    beforeEach(async () => {
      await request(app).post("/auth/register").send({
        email: "login_test@example.com",
        password: "securepassword123",
      });
    });

    it("successfully logs in with valid credentials and sets session cookie", async () => {
      const res = await request(app).post("/auth/login").send({
        email: "login_test@example.com",
        password: "securepassword123",
      });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe("login_test@example.com");

      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain("trao_session");
    });

    it("rejects login with incorrect password with 401", async () => {
      const res = await request(app).post("/auth/login").send({
        email: "login_test@example.com",
        password: "wrongpassword!",
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("rejects login with non-existent email with 401", async () => {
      const res = await request(app).post("/auth/login").send({
        email: "nobody@example.com",
        password: "securepassword123",
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    });
  });

  describe("Protected Routes & Session Persistence", () => {
    it("returns 401 when accessing protected route without session", async () => {
      const res = await request(app).get("/protected-test");
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 401 when accessing /auth/me without session", async () => {
      const res = await request(app).get("/auth/me");
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("allows access to protected routes with valid session cookie", async () => {
      // Login first
      const registerRes = await request(app).post("/auth/register").send({
        email: "session_user@example.com",
        password: "password12345",
      });

      const sessionCookie = registerRes.headers["set-cookie"];

      // Access /auth/me with cookie
      const meRes = await request(app)
        .get("/auth/me")
        .set("Cookie", sessionCookie);

      expect(meRes.status).toBe(200);
      expect(meRes.body.user.email).toBe("session_user@example.com");

      // Access protected test route with cookie
      const protectedRes = await request(app)
        .get("/protected-test")
        .set("Cookie", sessionCookie);

      expect(protectedRes.status).toBe(200);
      expect(protectedRes.body.status).toBe("ok");
    });

    it("destroys session and clears cookie on logout", async () => {
      const registerRes = await request(app).post("/auth/register").send({
        email: "logout_user@example.com",
        password: "password12345",
      });

      const sessionCookie = registerRes.headers["set-cookie"];

      // Logout
      const logoutRes = await request(app)
        .post("/auth/logout")
        .set("Cookie", sessionCookie);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.status).toBe("ok");

      // Subsequent access with the previous cookie is rejected
      const meRes = await request(app)
        .get("/auth/me")
        .set("Cookie", sessionCookie);

      expect(meRes.status).toBe(401);
    });
  });
});
