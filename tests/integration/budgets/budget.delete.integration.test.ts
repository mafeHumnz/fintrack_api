import request from "supertest";
import { CategoryType } from "@prisma/client";
import { prisma } from "../../../src/config/prisma.js";
import app from "../../../src/app.js";
import { generateToken } from "../../../src/utils/generateToken.js";

describe("DELETE /budgets/:id integration tests", () => {
  let userId: string;
  let token: string;
  let categoryId: string;
  let otherUserId: string;
  let otherToken: string;
  let otherCategoryId: string;
  let budgetId: string;
  let otherBudgetId: string;

  const baseUrl = "/budgets";

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

  const createCategory = async (userId: string, overrides: Partial<any> = {}) => {
    return prisma.category.create({
      data: {
        name: overrides.name ?? "Groceries",
        type: overrides.type ?? CategoryType.EXPENSE,
        userId,
      },
    });
  };

  const createBudget = async (userId: string, categoryId: string, overrides: Partial<any> = {}) => {
    return prisma.budget.create({
      data: {
        name: overrides.name ?? "Monthly budget",
        amount: overrides.amount ?? 500,
        month: overrides.month ?? 3,
        year: overrides.year ?? 2025,
        userId,
        categoryId,
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

    categoryId = (await createCategory(userId, { name: "Food" })).id;
    otherCategoryId = (await createCategory(otherUserId, { name: "Other category" })).id;

    budgetId = (await createBudget(userId, categoryId, { name: "Food budget", amount: 500, month: 3, year: 2025 })).id;
    otherBudgetId = (await createBudget(otherUserId, otherCategoryId, { amount: 300, month: 3, year: 2025 })).id;
  });

  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("successful deletion", () => {
    it("deletes an existing budget", async () => {
      const response = await request(app)
        .delete(`${baseUrl}/${budgetId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("Budget deleted successfully");
    });

    it("removes the budget from the database", async () => {
      await request(app).delete(`${baseUrl}/${budgetId}`).set("Authorization", `Bearer ${token}`);

      const budget = await prisma.budget.findUnique({ where: { id: budgetId } });
      expect(budget).toBeNull();
    });
  });

  describe("ownership and authorization", () => {
    it("rejects deleting a nonexistent budget", async () => {
      const response = await request(app)
        .delete(`${baseUrl}/00000000-0000-4000-8000-000000000000`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Budget not found");
    });

    it("rejects a malformed budget id", async () => {
      const response = await request(app)
        .delete(`${baseUrl}/not-a-uuid`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(400);
    });

    it("rejects deleting a budget belonging to another user", async () => {
      const response = await request(app)
        .delete(`${baseUrl}/${otherBudgetId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Budget not found or does not belong to the user");

      const budget = await prisma.budget.findUnique({ where: { id: otherBudgetId } });
      expect(budget).not.toBeNull(); // not deleted
    });

    it("rejects requests without an auth token", async () => {
      const response = await request(app).delete(`${baseUrl}/${budgetId}`);
      expect(response.status).toBe(401);
    });
  });

  describe("edge cases and regression scenarios", () => {
    it("deletes only the targeted budget, leaving other budgets of the same user intact", async () => {
      const secondBudget = await createBudget(userId, categoryId, { amount: 200, month: 6, year: 2025 });

      await request(app).delete(`${baseUrl}/${budgetId}`).set("Authorization", `Bearer ${token}`);

      const untouched = await prisma.budget.findUnique({ where: { id: secondBudget.id } });
      expect(untouched).not.toBeNull();
    });

    it("keeps budgets isolated between two different users when deleting", async () => {
      await request(app).delete(`${baseUrl}/${otherBudgetId}`).set("Authorization", `Bearer ${otherToken}`);

      const own = await prisma.budget.findUnique({ where: { id: budgetId } });
      expect(own).not.toBeNull(); // unaffected by another user's deletion
    });

    it("rejects deleting the same budget twice", async () => {
      const first = await request(app).delete(`${baseUrl}/${budgetId}`).set("Authorization", `Bearer ${token}`);
      const second = await request(app).delete(`${baseUrl}/${budgetId}`).set("Authorization", `Bearer ${token}`);

      expect(first.status).toBe(200);
      expect(second.status).toBe(400);
      expect(second.body.message).toContain("Budget not found");
    });

    it("allows deleting multiple different budgets sequentially", async () => {
      const secondBudget = await createBudget(userId, categoryId, { amount: 200, month: 6, year: 2025 });

      const first = await request(app).delete(`${baseUrl}/${budgetId}`).set("Authorization", `Bearer ${token}`);
      const second = await request(app).delete(`${baseUrl}/${secondBudget.id}`).set("Authorization", `Bearer ${token}`);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);

      const remaining = await prisma.budget.findMany({ where: { userId } });
      expect(remaining.length).toBe(0);
    });

    it("frees up the period for reuse after deletion", async () => {
      await request(app).delete(`${baseUrl}/${budgetId}`).set("Authorization", `Bearer ${token}`);

      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "New food budget", amount: 400, month: 3, year: 2025, categoryId });

      expect(response.status).toBe(201);
    });

    it("does not affect a category's ability to be used by a new budget after this one is deleted", async () => {
      await request(app).delete(`${baseUrl}/${budgetId}`).set("Authorization", `Bearer ${token}`);

      const category = await prisma.category.findUnique({ where: { id: categoryId } });
      expect(category).not.toBeNull(); // category itself is untouched by budget deletion
    });
  });
});