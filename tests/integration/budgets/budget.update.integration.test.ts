import request from "supertest";
import { CategoryType } from "@prisma/client";
import { prisma } from "../../../src/config/prisma.js";
import app from "../../../src/app.js";
import { generateToken } from "../../../src/utils/generateToken.js";

describe("PATCH /budgets/:id integration tests", () => {
  let userId: string;
  let token: string;
  let categoryId: string;
  let secondCategoryId: string;
  let otherUserId: string;
  let otherCategoryId: string;
  let otherBudgetId: string;
  let budgetId: string;

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

    categoryId = (await createCategory(userId, { name: "Food" })).id;
    secondCategoryId = (await createCategory(userId, { name: "Transport" })).id;
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

  describe("partial updates", () => {
    it("updates only the name", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${budgetId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Renamed budget" });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe("Renamed budget");
    });

    it("updates only the amount", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${budgetId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: 750 });

      expect(response.status).toBe(200);
      expect(response.body.amount).toBe(750);
    });

    it("updates only the month, moving to a free period", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${budgetId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ month: 4 });

      expect(response.status).toBe(200);
      expect(response.body.month).toBe(4);
    });

    it("updates only the year, moving to a free period", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${budgetId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ year: 2026 });

      expect(response.status).toBe(200);
      expect(response.body.year).toBe(2026);
    });

    it("updates the category to one without a conflicting budget", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${budgetId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ categoryId: secondCategoryId });

      expect(response.status).toBe(200);
      expect(response.body.categoryId).toBe(secondCategoryId);
    });

    it("updates multiple fields at once", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${budgetId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "New name", amount: 600, month: 5 });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe("New name");
      expect(response.body.amount).toBe(600);
      expect(response.body.month).toBe(5);
    });

    it("persists changes correctly in the database", async () => {
      await request(app).patch(`${baseUrl}/${budgetId}`).set("Authorization", `Bearer ${token}`).send({ amount: 999 });

      const budget = await prisma.budget.findUnique({ where: { id: budgetId } });
      expect(budget?.amount).toBe(999);
    });

    it("allows re-sending the budget's own current period without triggering a false duplicate", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${budgetId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ month: 3, year: 2025, categoryId, amount: 800 });

      expect(response.status).toBe(200);
      expect(response.body.amount).toBe(800);
    });
  });

  describe("duplicate period validation", () => {
    it("rejects updating month to one already used by another budget with the same category and year", async () => {
      await createBudget(userId, categoryId, { name: "April food", amount: 400, month: 4, year: 2025 });

      const response = await request(app)
        .patch(`${baseUrl}/${budgetId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ month: 4 });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("A budget already exists for this category and period");

      const budget = await prisma.budget.findUnique({ where: { id: budgetId } });
      expect(budget?.month).toBe(3); // unchanged
    });

    it("rejects updating category to one that already has a budget for the same month/year", async () => {
      await createBudget(userId, secondCategoryId, { name: "Transport budget", amount: 200, month: 3, year: 2025 });

      const response = await request(app)
        .patch(`${baseUrl}/${budgetId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ categoryId: secondCategoryId });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("A budget already exists for this category and period");
    });

    it("rejects updating year to one already used by another budget with the same category and month", async () => {
      await createBudget(userId, categoryId, { name: "Next year food", amount: 550, month: 3, year: 2026 });

      const response = await request(app)
        .patch(`${baseUrl}/${budgetId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ year: 2026 });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("A budget already exists for this category and period");
    });

    it("allows updating amount/name on a budget without conflict even if other budgets exist for other periods", async () => {
      await createBudget(userId, categoryId, { name: "April food", amount: 400, month: 4, year: 2025 });

      const response = await request(app)
        .patch(`${baseUrl}/${budgetId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: 650 });

      expect(response.status).toBe(200);
    });
  });

  describe("category validation", () => {
    it("rejects updating to a nonexistent category", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${budgetId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ categoryId: "11111111-1111-4111-8111-111111111111" });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Category not found");
    });

    it("rejects updating to a category belonging to another user", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${budgetId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ categoryId: otherCategoryId });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Category not found or does not belong to the user");
    });

    it("rejects a malformed categoryId", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${budgetId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ categoryId: "not-a-uuid" });

      expect(response.status).toBe(400);
    });
  });

  describe("invalid updates", () => {
    it("rejects an empty update body", async () => {
      const response = await request(app).patch(`${baseUrl}/${budgetId}`).set("Authorization", `Bearer ${token}`).send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("At least one field must be provided for update");
    });

    it("rejects an empty name", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${budgetId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "" });

      expect(response.status).toBe(400);
    });

    it("rejects a negative amount", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${budgetId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: -50 });

      expect(response.status).toBe(400);
    });

    it("rejects a month less than 1", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${budgetId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ month: 0 });

      expect(response.status).toBe(400);
    });

    it("rejects a month greater than 12", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${budgetId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ month: 13 });

      expect(response.status).toBe(400);
    });

    it("rejects a year below 2000", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${budgetId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ year: 1999 });

      expect(response.status).toBe(400);
    });

    it("rejects updating a nonexistent budget", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/00000000-0000-4000-8000-000000000000`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Ghost" });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Budget not found");
    });

    it("rejects a malformed budget id", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/not-a-uuid`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Anything" });

      expect(response.status).toBe(400);
    });
  });

  describe("ownership and authorization", () => {
    it("rejects updating a budget belonging to another user", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${otherBudgetId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: 9999 });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Budget not found or does not belong to the user");

      const budget = await prisma.budget.findUnique({ where: { id: otherBudgetId } });
      expect(budget?.amount).toBe(300); // unchanged
    });

    it("rejects requests without an auth token", async () => {
      const response = await request(app).patch(`${baseUrl}/${budgetId}`).send({ amount: 100 });
      expect(response.status).toBe(401);
    });
  });

  describe("edge cases and regression scenarios", () => {
    it("handles updating to a very large amount without corrupting the value", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${budgetId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: 999_999_999 });

      expect(response.status).toBe(200);
      expect(response.body.amount).toBe(999_999_999);
    });

    it("handles a decimal amount update correctly", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${budgetId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: 333.33 });

      expect(response.status).toBe(200);
      expect(response.body.amount).toBeCloseTo(333.33, 2);
    });

    it("supports repeated updates on the same budget without drift", async () => {
      await request(app).patch(`${baseUrl}/${budgetId}`).set("Authorization", `Bearer ${token}`).send({ amount: 400 });
      await request(app).patch(`${baseUrl}/${budgetId}`).set("Authorization", `Bearer ${token}`).send({ amount: 600 });

      const budget = await prisma.budget.findUnique({ where: { id: budgetId } });
      expect(budget?.amount).toBe(600);
    });

    it("keeps two budgets independent when updating one of them", async () => {
      const secondBudget = await createBudget(userId, secondCategoryId, { amount: 200, month: 6, year: 2025 });

      await request(app).patch(`${baseUrl}/${budgetId}`).set("Authorization", `Bearer ${token}`).send({ amount: 100 });

      const untouched = await prisma.budget.findUnique({ where: { id: secondBudget.id } });
      expect(untouched?.amount).toBe(200);
    });

    it("keeps budgets isolated between two different users when updating", async () => {
      await request(app)
        .patch(`${baseUrl}/${otherBudgetId}`)
        .set("Authorization", `Bearer ${generateToken(otherUserId)}`)
        .send({ amount: 9999 });

      const own = await prisma.budget.findUnique({ where: { id: budgetId } });
      expect(own?.amount).toBe(500); // unaffected by another user's update
    });

    it("moving a budget to a new period frees up its old period for reuse", async () => {
      await request(app).patch(`${baseUrl}/${budgetId}`).set("Authorization", `Bearer ${token}`).send({ month: 7 });

      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "New March budget", amount: 300, month: 3, year: 2025, categoryId });

      expect(response.status).toBe(201);
    });
  });
});