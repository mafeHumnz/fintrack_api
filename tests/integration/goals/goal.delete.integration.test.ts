import request from "supertest";
import { prisma } from "../../../src/config/prisma.js";
import app from "../../../src/app.js";
import { generateToken } from "../../../src/utils/generateToken.js";

describe("DELETE /goals/:id integration tests", () => {
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

    goalId = (await createGoal(userId, { name: "Car" })).id;
    otherGoalId = (await createGoal(otherUserId, { name: "Other goal" })).id;
  });

  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("successful deletion", () => {
    it("deletes an existing goal", async () => {
      const response = await request(app)
        .delete(`${baseUrl}/${goalId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("Goal deleted successfully");
    });

    it("removes the goal from the database", async () => {
      await request(app).delete(`${baseUrl}/${goalId}`).set("Authorization", `Bearer ${token}`);

      const goal = await prisma.goal.findUnique({ where: { id: goalId } });
      expect(goal).toBeNull();
    });
  });

  describe("ownership and authorization", () => {
    it("rejects deleting a nonexistent goal", async () => {
      const response = await request(app)
        .delete(`${baseUrl}/00000000-0000-4000-8000-000000000000`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Goal not found");
    });

    it("rejects a malformed goal id", async () => {
      const response = await request(app)
        .delete(`${baseUrl}/not-a-uuid`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(400);
    });

    it("rejects deleting a goal belonging to another user", async () => {
      const response = await request(app)
        .delete(`${baseUrl}/${otherGoalId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Goal not found or does not belong to the user");

      const goal = await prisma.goal.findUnique({ where: { id: otherGoalId } });
      expect(goal).not.toBeNull(); // not deleted
    });

    it("rejects requests without an auth token", async () => {
      const response = await request(app).delete(`${baseUrl}/${goalId}`);
      expect(response.status).toBe(401);
    });
  });

  describe("edge cases and regression scenarios", () => {
    it("deletes only the targeted goal, leaving other goals of the same user intact", async () => {
      const secondGoal = await createGoal(userId, { name: "House" });

      await request(app).delete(`${baseUrl}/${goalId}`).set("Authorization", `Bearer ${token}`);

      const untouched = await prisma.goal.findUnique({ where: { id: secondGoal.id } });
      expect(untouched).not.toBeNull();
    });

    it("keeps goals isolated between two different users when deleting", async () => {
      await request(app).delete(`${baseUrl}/${otherGoalId}`).set("Authorization", `Bearer ${otherToken}`);

      const own = await prisma.goal.findUnique({ where: { id: goalId } });
      expect(own).not.toBeNull(); // unaffected by another user's deletion
    });

    it("rejects deleting the same goal twice", async () => {
      const first = await request(app).delete(`${baseUrl}/${goalId}`).set("Authorization", `Bearer ${token}`);
      const second = await request(app).delete(`${baseUrl}/${goalId}`).set("Authorization", `Bearer ${token}`);

      expect(first.status).toBe(200);
      expect(second.status).toBe(400);
      expect(second.body.message).toContain("Goal not found");
    });

    it("allows deleting multiple different goals sequentially", async () => {
      const secondGoal = await createGoal(userId, { name: "House" });

      const first = await request(app).delete(`${baseUrl}/${goalId}`).set("Authorization", `Bearer ${token}`);
      const second = await request(app).delete(`${baseUrl}/${secondGoal.id}`).set("Authorization", `Bearer ${token}`);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);

      const remaining = await prisma.goal.findMany({ where: { userId } });
      expect(remaining.length).toBe(0);
    });

    it("allows creating a new goal with the same name after the original was deleted", async () => {
      await request(app).delete(`${baseUrl}/${goalId}`).set("Authorization", `Bearer ${token}`);

      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Car",
          targetAmount: 1000,
          currentAmount: 0,
          targetDate: futureDate(1).toISOString(),
        });

      expect(response.status).toBe(201);
    });
  });
});