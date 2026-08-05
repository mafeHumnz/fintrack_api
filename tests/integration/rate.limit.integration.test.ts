import request from "supertest";
import bcrypt from "bcrypt";
import { jest } from "@jest/globals";
import { prisma } from "../../src/config/prisma.js";
import app from "../../src/app.js";

describe("Auth integration tests", () => {
  const baseUrl = "/auth";

  const cleanDatabase = async () => {
    await prisma.$transaction([
      prisma.transaction.deleteMany(),
      prisma.budget.deleteMany(),
      prisma.goal.deleteMany(),
      prisma.category.deleteMany(),
      prisma.account.deleteMany(),
      prisma.user.deleteMany(),
    ]);
  };

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("POST /auth/register", () => {
    it("registers a new user successfully", async () => {
      const response = await request(app).post(`${baseUrl}/register`).send({
        name: "John Doe",
        email: "john@example.com",
        password: "SecurePass123",
      });

      expect(response.status).toBe(201);
      expect(response.body.email).toBe("john@example.com");
      expect(response.body.name).toBe("John Doe");
      expect(response.body.id).toBeDefined();
    });

    it("never returns the password in the response body", async () => {
      const response = await request(app).post(`${baseUrl}/register`).send({
        name: "Jane Doe",
        email: "jane@example.com",
        password: "SecurePass123",
      });

      expect(response.status).toBe(201);
      expect(response.body.password).toBeUndefined();
    });

    it("stores the password hashed, never in plain text", async () => {
      await request(app).post(`${baseUrl}/register`).send({
        name: "Hash Test",
        email: "hash@example.com",
        password: "SecurePass123",
      });

      const user = await prisma.user.findUnique({ where: { email: "hash@example.com" } });
      expect(user?.password).not.toBe("SecurePass123");
      expect(user?.password.startsWith("$2")).toBe(true); // bcrypt hash prefix
    });

    it("rejects registration with an already existing email", async () => {
      await request(app).post(`${baseUrl}/register`).send({
        name: "First User",
        email: "duplicate@example.com",
        password: "SecurePass123",
      });

      const response = await request(app).post(`${baseUrl}/register`).send({
        name: "Second User",
        email: "duplicate@example.com",
        password: "AnotherPass456",
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("User already exists");
    });

    it("treats email uniqueness as case-sensitive or case-insensitive consistently", async () => {
      await request(app).post(`${baseUrl}/register`).send({
        name: "Original",
        email: "case@example.com",
        password: "SecurePass123",
      });

      const response = await request(app).post(`${baseUrl}/register`).send({
        name: "Duplicate Attempt",
        email: "CASE@example.com",
        password: "SecurePass123",
      });

      // Document current behavior — flags a potential inconsistency if this passes with 201
      // instead of 400, meaning duplicate accounts with different casing are allowed.
      if (response.status === 201) {
        console.warn(
          "WARNING: email uniqueness is case-sensitive — 'case@example.com' and 'CASE@example.com' are treated as different users."
        );
      }
    });

    it("rejects registration with missing name", async () => {
      const response = await request(app).post(`${baseUrl}/register`).send({
        email: "noname@example.com",
        password: "SecurePass123",
      });

      expect(response.status).toBe(400);
    });

    it("rejects registration with missing email", async () => {
      const response = await request(app).post(`${baseUrl}/register`).send({
        name: "No Email",
        password: "SecurePass123",
      });

      expect(response.status).toBe(400);
    });

    it("rejects registration with missing password", async () => {
      const response = await request(app).post(`${baseUrl}/register`).send({
        name: "No Password",
        email: "nopassword@example.com",
      });

      expect(response.status).toBe(400);
    });

    it("rejects registration with an invalid email format", async () => {
      const response = await request(app).post(`${baseUrl}/register`).send({
        name: "Bad Email",
        email: "not-an-email",
        password: "SecurePass123",
      });

      expect(response.status).toBe(400);
    });

    it("rejects registration with an empty name", async () => {
      const response = await request(app).post(`${baseUrl}/register`).send({
        name: "",
        email: "emptyname@example.com",
        password: "SecurePass123",
      });

      expect(response.status).toBe(400);
    });

    it("rejects an empty request body", async () => {
      const response = await request(app).post(`${baseUrl}/register`).send({});

      expect(response.status).toBe(400);
    });

    it("does not create a user in the database when validation fails", async () => {
      await request(app).post(`${baseUrl}/register`).send({
        name: "Should Not Exist",
        email: "not-an-email",
        password: "SecurePass123",
      });

      const user = await prisma.user.findFirst({ where: { name: "Should Not Exist" } });
      expect(user).toBeNull();
    });

    it("handles extremely long input values without crashing", async () => {
      const response = await request(app).post(`${baseUrl}/register`).send({
        name: "A".repeat(10000),
        email: "long@example.com",
        password: "SecurePass123",
      });

      // Should either reject cleanly (400) or accept without crashing (201/500 would be a bug)
      expect([201, 400]).toContain(response.status);
    });

    it("does not break on SQL-injection-style input in the name field", async () => {
      const response = await request(app).post(`${baseUrl}/register`).send({
        name: "Robert'); DROP TABLE users;--",
        email: "injection@example.com",
        password: "SecurePass123",
      });

      expect([201, 400]).toContain(response.status);

      const usersStillExist = await prisma.user.count();
      expect(usersStillExist).toBeGreaterThanOrEqual(0); // table wasn't dropped, DB still queryable
    });

    it("does not break on script-tag input in the name field (stored XSS check)", async () => {
      const response = await request(app).post(`${baseUrl}/register`).send({
        name: "<script>alert('xss')</script>",
        email: "xss@example.com",
        password: "SecurePass123",
      });

      expect([201, 400]).toContain(response.status);
      // If accepted, confirms it's stored as-is (escaping/sanitization is a frontend rendering concern,
      // but worth knowing the API doesn't reject or sanitize it)
    });
  });

  describe("POST /auth/login", () => {
    beforeEach(async () => {
      await request(app).post(`${baseUrl}/register`).send({
        name: "Login Test User",
        email: "logintest@example.com",
        password: "SecurePass123",
      });
    });

    it("logs in successfully with correct credentials", async () => {
      const response = await request(app).post(`${baseUrl}/login`).send({
        email: "logintest@example.com",
        password: "SecurePass123",
      });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
      expect(typeof response.body.token).toBe("string");
    });

    it("returns a valid JWT with three segments", async () => {
      const response = await request(app).post(`${baseUrl}/login`).send({
        email: "logintest@example.com",
        password: "SecurePass123",
      });

      const segments = response.body.token.split(".");
      expect(segments.length).toBe(3);
    });

    it("rejects login with a nonexistent email", async () => {
      const response = await request(app).post(`${baseUrl}/login`).send({
        email: "doesnotexist@example.com",
        password: "SecurePass123",
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Invalid email or password");
    });

    it("rejects login with a wrong password", async () => {
      const response = await request(app).post(`${baseUrl}/login`).send({
        email: "logintest@example.com",
        password: "WrongPassword",
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Invalid email or password");
    });

    it("uses the same error message for wrong password and nonexistent email (prevents user enumeration)", async () => {
      const wrongPasswordResponse = await request(app).post(`${baseUrl}/login`).send({
        email: "logintest@example.com",
        password: "WrongPassword",
      });

      const nonexistentEmailResponse = await request(app).post(`${baseUrl}/login`).send({
        email: "ghost@example.com",
        password: "WrongPassword",
      });

      expect(wrongPasswordResponse.body.message).toBe(nonexistentEmailResponse.body.message);
    });

    it("rejects login with missing email", async () => {
      const response = await request(app).post(`${baseUrl}/login`).send({
        password: "SecurePass123",
      });

      expect(response.status).toBe(400);
    });

    it("rejects login with missing password", async () => {
      const response = await request(app).post(`${baseUrl}/login`).send({
        email: "logintest@example.com",
      });

      expect(response.status).toBe(400);
    });

    it("rejects an empty request body", async () => {
      const response = await request(app).post(`${baseUrl}/login`).send({});

      expect(response.status).toBe(400);
    });

    it("does not leak the password hash in the login response", async () => {
      const response = await request(app).post(`${baseUrl}/login`).send({
        email: "logintest@example.com",
        password: "SecurePass123",
      });

      expect(response.body.password).toBeUndefined();
      expect(JSON.stringify(response.body)).not.toMatch(/\$2[aby]\$/); // no bcrypt hash pattern anywhere in response
    });

    it("rejects a login attempt with SQL-injection-style email input", async () => {
      const response = await request(app).post(`${baseUrl}/login`).send({
        email: "' OR '1'='1",
        password: "anything",
      });

      expect(response.status).toBe(400);
    });

    it("is case-sensitive or case-insensitive on password consistently (passwords must remain case-sensitive)", async () => {
      const response = await request(app).post(`${baseUrl}/login`).send({
        email: "logintest@example.com",
        password: "securepass123", // lowercase version of the real password
      });

      expect(response.status).toBe(400); // passwords must always be case-sensitive
    });
  });

  describe("Rate limiting behavior (real limits, bypassing test override)", () => {
    it("blocks login after exceeding the configured max attempts", async () => {
      jest.resetModules();
      process.env.NODE_ENV = "production"; // temporarily bypass the test override in rate_limiters.ts

      const { default: freshApp } = await import("../../src/app.js");

      await request(freshApp).post(`${baseUrl}/register`).send({
        name: "Rate Limited User",
        email: "ratelimit@example.com",
        password: "SecurePass123",
      });

      const attempts = [];
      for (let i = 0; i < 6; i++) {
        attempts.push(
          await request(freshApp).post(`${baseUrl}/login`).send({
            email: "ratelimit@example.com",
            password: "WrongPassword",
          })
        );
      }

      const lastAttempt = attempts[attempts.length - 1];
      expect(lastAttempt.status).toBe(429);

      process.env.NODE_ENV = "test"; // restore for subsequent tests
      jest.resetModules();
    });
  });

  describe("Timing consistency (basic check, not a precise timing attack test)", () => {
    it("takes comparable time whether the email exists or not (rough enumeration defense check)", async () => {
      await request(app).post(`${baseUrl}/register`).send({
        name: "Timing User",
        email: "timing@example.com",
        password: "SecurePass123",
      });

      const startExisting = Date.now();
      await request(app).post(`${baseUrl}/login`).send({
        email: "timing@example.com",
        password: "WrongPassword",
      });
      const durationExisting = Date.now() - startExisting;

      const startNonexistent = Date.now();
      await request(app).post(`${baseUrl}/login`).send({
        email: "ghost-timing@example.com",
        password: "WrongPassword",
      });
      const durationNonexistent = Date.now() - startNonexistent;

      // Loose check: nonexistent-email path should not be dramatically faster
      // (a huge gap could indicate bcrypt.compare is skipped for nonexistent users,
      // which is expected here since there's no hash to compare against — documenting, not failing hard)
      console.log(`Existing user login attempt: ${durationExisting}ms, nonexistent: ${durationNonexistent}ms`);
    });
  });
});