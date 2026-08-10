import request from "supertest";
import { prisma } from "../../../src/config/prisma.js";
import app from "../../../src/app.js";
import { generateToken } from "../../../src/utils/generateToken.js";

describe("POST /goals integration tests", () => {
  let userId: string;
  let token: string;

  const baseUrl = "/goals";

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

  const createUser = async (email: string) => {
    return prisma.user.create({
      data: { name: `User ${email}`, email, password: "hashed-password" },
    });
  };

  const futureDate = (yearsFromNow = 1) => {
    const date = new Date();
    date.setFullYear(date.getFullYear() + yearsFromNow);
    return date.toISOString();
  };

  const pastDate = () => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 1);
    return date.toISOString();
  };

  const validPayload = (overrides: Partial<any> = {}) => ({
    name: overrides.name ?? "New car",
    targetAmount: overrides.targetAmount ?? 80_000_000,
    currentAmount: overrides.currentAmount ?? 10_000_000,
    targetDate: overrides.targetDate ?? futureDate(2),
  });

  beforeEach(async () => {
    await cleanDatabase();

    const owner = await createUser("owner@example.com");
    userId = owner.id;
    token = generateToken(userId);
  });

  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("successful creation", () => {
    it("creates a goal with valid data", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload());

      expect(response.status).toBe(201);
      expect(response.body.name).toBe("New car");
      expect(response.body.targetAmount).toBe(80_000_000);
      expect(response.body.currentAmount).toBe(10_000_000);
    });

    it("persists the goal correctly in the database", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload());

      const goal = await prisma.goal.findUnique({ where: { id: response.body.id } });
      expect(goal).not.toBeNull();
      expect(goal?.userId).toBe(userId);
    });

    it("creates a goal with currentAmount equal to 0", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ currentAmount: 0 }));

      expect(response.status).toBe(201);
      expect(response.body.currentAmount).toBe(0);
    });

    it("creates a goal with currentAmount exactly equal to targetAmount", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ targetAmount: 1000, currentAmount: 1000 }));

      expect(response.status).toBe(201);
      expect(response.body.targetAmount).toBe(1000);
      expect(response.body.currentAmount).toBe(1000);

      // The create endpoint returns the raw persisted goal (no computed summary fields).
      // Progress/completed/remaining/daysRemaining are only computed by findAll/findById.
      const persisted = await prisma.goal.findUnique({ where: { id: response.body.id } });
      expect(persisted?.currentAmount).toBe(persisted?.targetAmount);
    });

    it("returns a computed summary (progress, remaining, completed, daysRemaining) when fetched via GET after creation", async () => {
      const created = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ targetAmount: 1000, currentAmount: 250 }));

      const response = await request(app)
        .get(`${baseUrl}/${created.body.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.progress).toBe(25);
      expect(response.body.remaining).toBe(750);
      expect(response.body.completed).toBe(false);
      expect(response.body.daysRemaining).toBeGreaterThan(0);
    });
  });

  describe("business rule validations", () => {
    it("rejects a currentAmount greater than targetAmount", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ targetAmount: 1000, currentAmount: 1500 }));

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Current amount cannot exceed target amount");
    });

    it("rejects a target date in the past", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ targetDate: pastDate() }));

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Target date must be in the future");
    });

    it("rejects a target date equal to right now (not strictly in the future)", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ targetDate: new Date().toISOString() }));

      expect(response.status).toBe(400);
    });

    it("does not persist a goal when business rule validation fails", async () => {
      await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ targetAmount: 1000, currentAmount: 1500 }));

      const goals = await prisma.goal.findMany({ where: { userId } });
      expect(goals.length).toBe(0);
    });
  });

  describe("input validation", () => {
    it("rejects a targetAmount of 0", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ targetAmount: 0 }));

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Target amount must be greater than 0");
    });

    it("rejects a negative targetAmount", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ targetAmount: -500 }));

      expect(response.status).toBe(400);
    });

    it("rejects a negative currentAmount", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ currentAmount: -1 }));

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Current amount cannot be negative");
    });

    it("rejects an empty name", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ name: "" }));

      expect(response.status).toBe(400);
    });

    it("rejects a missing name", async () => {
      const payload = validPayload();
      delete (payload as any).name;

      const response = await request(app).post(baseUrl).set("Authorization", `Bearer ${token}`).send(payload);
      expect(response.status).toBe(400);
    });

    it("rejects a missing targetAmount", async () => {
      const payload = validPayload();
      delete (payload as any).targetAmount;

      const response = await request(app).post(baseUrl).set("Authorization", `Bearer ${token}`).send(payload);
      expect(response.status).toBe(400);
    });

    it("rejects a missing currentAmount", async () => {
      const payload = validPayload();
      delete (payload as any).currentAmount;

      const response = await request(app).post(baseUrl).set("Authorization", `Bearer ${token}`).send(payload);
      expect(response.status).toBe(400);
    });

    it("rejects a missing targetDate", async () => {
      const payload = validPayload();
      delete (payload as any).targetDate;

      const response = await request(app).post(baseUrl).set("Authorization", `Bearer ${token}`).send(payload);
      expect(response.status).toBe(400);
    });

    it("rejects an invalid targetDate format", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ targetDate: "not-a-date" }));

      expect(response.status).toBe(400);
    });

    it("rejects an empty request body", async () => {
      const response = await request(app).post(baseUrl).set("Authorization", `Bearer ${token}`).send({});
      expect(response.status).toBe(400);
    });
  });

  describe("ownership and authorization", () => {
    it("rejects requests without an auth token", async () => {
      const response = await request(app).post(baseUrl).send(validPayload());
      expect(response.status).toBe(401);
    });

    it("associates the created goal with the authenticated user", async () => {
      const response = await request(app).post(baseUrl).set("Authorization", `Bearer ${token}`).send(validPayload());

      const goal = await prisma.goal.findUnique({ where: { id: response.body.id } });
      expect(goal?.userId).toBe(userId);
    });
  });

  describe("edge cases", () => {
    it("handles a very large targetAmount without corrupting the value", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ targetAmount: 999_999_999_999, currentAmount: 0 }));

      expect(response.status).toBe(201);
      expect(response.body.targetAmount).toBe(999_999_999_999);
    });

    it("handles a decimal targetAmount and currentAmount correctly", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ targetAmount: 1000.5, currentAmount: 250.25 }));

      expect(response.status).toBe(201);
      expect(response.body.targetAmount).toBeCloseTo(1000.5, 2);
      expect(response.body.currentAmount).toBeCloseTo(250.25, 2);
    });

    it("accepts a target date far in the future", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ targetDate: futureDate(50) }));

      expect(response.status).toBe(201);
    });

    it("allows creating multiple goals for the same user", async () => {
      await request(app).post(baseUrl).set("Authorization", `Bearer ${token}`).send(validPayload({ name: "Car" }));
      await request(app).post(baseUrl).set("Authorization", `Bearer ${token}`).send(validPayload({ name: "House" }));

      const goals = await prisma.goal.findMany({ where: { userId } });
      expect(goals.length).toBe(2);
    });

    it("allows creating two goals with the same name (no uniqueness constraint on goal name)", async () => {
      const first = await request(app).post(baseUrl).set("Authorization", `Bearer ${token}`).send(validPayload({ name: "Car" }));
      const second = await request(app).post(baseUrl).set("Authorization", `Bearer ${token}`).send(validPayload({ name: "Car" }));

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
    });
  });
});