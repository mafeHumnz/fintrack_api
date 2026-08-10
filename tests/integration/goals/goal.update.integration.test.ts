import request from "supertest";
import { prisma } from "../../../src/config/prisma.js";
import app from "../../../src/app.js";
import { generateToken } from "../../../src/utils/generateToken.js";

describe("PATCH /goals/:id integration tests", () => {
  let userId: string;
  let token: string;
  let otherUserId: string;
  let otherToken: string;
  let goalId: string;
  let otherGoalId: string;

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
    return date;
  };

  const pastDate = () => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 1);
    return date;
  };

  const createGoal = async (userId: string, overrides: Partial<any> = {}) => {
    return prisma.goal.create({
      data: {
        name: overrides.name ?? "New car",
        targetAmount: overrides.targetAmount ?? 80_000_000,
        currentAmount: overrides.currentAmount ?? 10_000_000,
        targetDate: overrides.targetDate ?? futureDate(2),
        userId,
      },
    });
  };

  beforeEach(async () => {
    await cleanDatabase();

    const owner = await createUser("owner@example.com");
    userId = owner.id;
    token = generateToken(userId);

    const otherOwner = await createUser("other@example.com");
    otherUserId = otherOwner.id;
    otherToken = generateToken(otherUserId);

    goalId = (await createGoal(userId, { name: "Car", targetAmount: 1000, currentAmount: 200 })).id;
    otherGoalId = (await createGoal(otherUserId, { name: "Other goal", targetAmount: 500, currentAmount: 100 })).id;
  });

  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("partial updates", () => {
    it("updates only the name", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${goalId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Renamed goal" });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe("Renamed goal");
    });

    it("updates only the targetAmount", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${goalId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ targetAmount: 2000 });

      expect(response.status).toBe(200);
      expect(response.body.targetAmount).toBe(2000);
    });

    it("updates only the currentAmount", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${goalId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ currentAmount: 500 });

      expect(response.status).toBe(200);
      expect(response.body.currentAmount).toBe(500);
    });

    it("updates only the targetDate", async () => {
      const newDate = futureDate(5);

      const response = await request(app)
        .patch(`${baseUrl}/${goalId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ targetDate: newDate.toISOString() });

      expect(response.status).toBe(200);
      expect(new Date(response.body.targetDate).toISOString()).toBe(newDate.toISOString());
    });

    it("updates multiple fields at once", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${goalId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "New name", targetAmount: 5000, currentAmount: 1000 });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe("New name");
      expect(response.body.targetAmount).toBe(5000);
      expect(response.body.currentAmount).toBe(1000);
    });

    it("persists changes correctly in the database", async () => {
      await request(app).patch(`${baseUrl}/${goalId}`).set("Authorization", `Bearer ${token}`).send({ currentAmount: 900 });

      const goal = await prisma.goal.findUnique({ where: { id: goalId } });
      expect(goal?.currentAmount).toBe(900);
    });
  });

  describe("business rule validations", () => {
    it("rejects updating currentAmount above the existing targetAmount", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${goalId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ currentAmount: 1500 }); // targetAmount is 1000

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Current amount cannot exceed target amount");

      const goal = await prisma.goal.findUnique({ where: { id: goalId } });
      expect(goal?.currentAmount).toBe(200); // unchanged
    });

    it("rejects updating targetAmount below the existing currentAmount", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${goalId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ targetAmount: 100 }); // currentAmount is 200

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Current amount cannot exceed target amount");
    });

    it("allows updating both targetAmount and currentAmount together when consistent", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${goalId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ targetAmount: 300, currentAmount: 300 });

      expect(response.status).toBe(200);
    });

    it("rejects updating both targetAmount and currentAmount together when inconsistent", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${goalId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ targetAmount: 300, currentAmount: 400 });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Current amount cannot exceed target amount");
    });

    it("rejects a targetDate update in the past", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${goalId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ targetDate: pastDate().toISOString() });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Target date must be in the future");
    });
  });

  describe("invalid updates", () => {
    it("rejects an empty update body", async () => {
      const response = await request(app).patch(`${baseUrl}/${goalId}`).set("Authorization", `Bearer ${token}`).send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("At least one field must be provided for update");
    });

    it("rejects an empty name", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${goalId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "" });

      expect(response.status).toBe(400);
    });

    it("rejects a targetAmount of 0", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${goalId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ targetAmount: 0 });

      expect(response.status).toBe(400);
    });

    it("rejects a negative currentAmount", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${goalId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ currentAmount: -50 });

      expect(response.status).toBe(400);
    });

    it("rejects an invalid targetDate format", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${goalId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ targetDate: "not-a-date" });

      expect(response.status).toBe(400);
    });

    it("rejects updating a nonexistent goal", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/00000000-0000-4000-8000-000000000000`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Ghost" });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Goal not found");
    });

    it("rejects a malformed goal id", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/not-a-uuid`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Anything" });

      expect(response.status).toBe(400);
    });
  });

  describe("ownership and authorization", () => {
    it("rejects updating a goal belonging to another user", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${otherGoalId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Hijacked" });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Goal not found or does not belong to the user");

      const goal = await prisma.goal.findUnique({ where: { id: otherGoalId } });
      expect(goal?.name).toBe("Other goal"); // unchanged
    });

    it("rejects requests without an auth token", async () => {
      const response = await request(app).patch(`${baseUrl}/${goalId}`).send({ name: "No auth" });
      expect(response.status).toBe(401);
    });
  });

  describe("edge cases and regression scenarios", () => {
    it("handles updating to a very large targetAmount without corrupting the value", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${goalId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ targetAmount: 999_999_999_999 });

      expect(response.status).toBe(200);
      expect(response.body.targetAmount).toBe(999_999_999_999);
    });

    it("handles a decimal amount update correctly", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${goalId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ currentAmount: 333.33 });

      expect(response.status).toBe(200);
      expect(response.body.currentAmount).toBeCloseTo(333.33, 2);
    });

    it("supports repeated updates on the same goal without drift", async () => {
      await request(app).patch(`${baseUrl}/${goalId}`).set("Authorization", `Bearer ${token}`).send({ currentAmount: 400 });
      await request(app).patch(`${baseUrl}/${goalId}`).set("Authorization", `Bearer ${token}`).send({ currentAmount: 600 });

      const goal = await prisma.goal.findUnique({ where: { id: goalId } });
      expect(goal?.currentAmount).toBe(600);
    });

    it("allows setting currentAmount equal to targetAmount to mark the goal as completed", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${goalId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ currentAmount: 1000 });

      expect(response.status).toBe(200);

      const check = await request(app).get(`${baseUrl}/${goalId}`).set("Authorization", `Bearer ${token}`);
      expect(check.body.completed).toBe(true);
    });

    it("keeps two goals independent when updating one of them", async () => {
      const secondGoal = await createGoal(userId, { name: "House", targetAmount: 5000, currentAmount: 1000 });

      await request(app).patch(`${baseUrl}/${goalId}`).set("Authorization", `Bearer ${token}`).send({ currentAmount: 900 });

      const untouched = await prisma.goal.findUnique({ where: { id: secondGoal.id } });
      expect(untouched?.currentAmount).toBe(1000);
    });

    it("keeps goals isolated between two different users when updating", async () => {
      await request(app)
        .patch(`${baseUrl}/${otherGoalId}`)
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ currentAmount: 450 });

      const own = await prisma.goal.findUnique({ where: { id: goalId } });
      expect(own?.currentAmount).toBe(200); // unaffected by another user's update
    });
  });
});