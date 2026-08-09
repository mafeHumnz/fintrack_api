import request from "supertest";
import { CategoryType } from "@prisma/client";
import { prisma } from "../../../src/config/prisma.js";
import app from "../../../src/app.js";
import { generateToken } from "../../../src/utils/generateToken.js";

describe("POST /budgets integration tests", () => {
  let userId: string;
  let token: string;
  let categoryId: string;
  let otherUserId: string;
  let otherCategoryId: string;

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

  const validPayload = (overrides: Partial<any> = {}) => ({
    name: overrides.name ?? "Monthly groceries",
    amount: overrides.amount ?? 500,
    month: overrides.month ?? 3,
    year: overrides.year ?? 2025,
    categoryId: overrides.categoryId ?? categoryId,
  });

  beforeEach(async () => {
    await cleanDatabase();

    const owner = await createUser("owner@example.com");
    userId = owner.id;
    token = generateToken(userId);

    const otherOwner = await createUser("other@example.com");
    otherUserId = otherOwner.id;

    categoryId = (await createCategory(userId, { name: "Food" })).id;
    otherCategoryId = (await createCategory(otherUserId, { name: "Other category" })).id;
  });

  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("successful creation", () => {
    it("creates a budget with valid data", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload());

      expect(response.status).toBe(201);
      expect(response.body.name).toBe("Monthly groceries");
      expect(response.body.amount).toBe(500);
      expect(response.body.month).toBe(3);
      expect(response.body.year).toBe(2025);
      expect(response.body.categoryId).toBe(categoryId);
    });

    it("persists the budget correctly in the database", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload());

      const budget = await prisma.budget.findUnique({ where: { id: response.body.id } });
      expect(budget).not.toBeNull();
      expect(budget?.userId).toBe(userId);
    });

    it("creates a budget with amount equal to 0", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ amount: 0 }));

      expect(response.status).toBe(201);
      expect(response.body.amount).toBe(0);
    });

    it("creates budgets for different categories in the same month/year", async () => {
      const secondCategory = await createCategory(userId, { name: "Transport" });

      const first = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ categoryId }));

      const second = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ categoryId: secondCategory.id }));

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
    });

    it("creates budgets for the same category in different months", async () => {
      const first = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ month: 3 }));

      const second = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ month: 4 }));

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
    });

    it("creates budgets for the same category and month but different years", async () => {
      const first = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ year: 2025 }));

      const second = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ year: 2026 }));

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
    });
  });

  describe("duplicate period validation", () => {
    it("rejects creating a second budget for the same category, month, and year", async () => {
      await request(app).post(baseUrl).set("Authorization", `Bearer ${token}`).send(validPayload());

      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ name: "Duplicate attempt" }));

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("A budget already exists for this category and period");
    });

    it("allows two different users to have a budget for the same category name and period independently", async () => {
      const otherToken = generateToken(otherUserId);

      const first = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ categoryId, month: 5, year: 2025 }));

      const second = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${otherToken}`)
        .send(validPayload({ categoryId: otherCategoryId, month: 5, year: 2025 }));

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
    });

    it("does not persist a duplicate budget when validation fails", async () => {
      await request(app).post(baseUrl).set("Authorization", `Bearer ${token}`).send(validPayload());
      await request(app).post(baseUrl).set("Authorization", `Bearer ${token}`).send(validPayload());

      const budgets = await prisma.budget.findMany({ where: { userId, categoryId, month: 3, year: 2025 } });
      expect(budgets.length).toBe(1);
    });
  });

  describe("month and year validation", () => {
    it("rejects a month less than 1", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ month: 0 }));

      expect(response.status).toBe(400);
    });

    it("rejects a month greater than 12", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ month: 13 }));

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Month must be between 1 and 12");
    });

    it("rejects a non-integer month", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ month: 3.5 }));

      expect(response.status).toBe(400);
    });

    it("rejects a year below 2000", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ year: 1999 }));

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Year must be greater than or equal to 2000");
    });

    it("rejects a non-integer year", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ year: 2025.5 }));

      expect(response.status).toBe(400);
    });

    it("accepts the boundary month value 1", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ month: 1 }));

      expect(response.status).toBe(201);
    });

    it("accepts the boundary month value 12", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ month: 12 }));

      expect(response.status).toBe(201);
    });

    it("accepts the boundary year value 2000", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ year: 2000 }));

      expect(response.status).toBe(201);
    });
  });

  describe("category validation", () => {
    it("rejects a nonexistent category", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ categoryId: "11111111-1111-4111-8111-111111111111" }));

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Category not found");
    });

    it("rejects a category belonging to another user", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ categoryId: otherCategoryId }));

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Category not found or does not belong to the user");
    });

    it("rejects a malformed categoryId", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ categoryId: "not-a-uuid" }));

      expect(response.status).toBe(400);
    });
  });

  describe("input validation", () => {
    it("rejects a negative amount", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ amount: -100 }));

      expect(response.status).toBe(400);
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

    it("rejects a missing amount", async () => {
      const payload = validPayload();
      delete (payload as any).amount;

      const response = await request(app).post(baseUrl).set("Authorization", `Bearer ${token}`).send(payload);
      expect(response.status).toBe(400);
    });

    it("rejects a missing month", async () => {
      const payload = validPayload();
      delete (payload as any).month;

      const response = await request(app).post(baseUrl).set("Authorization", `Bearer ${token}`).send(payload);
      expect(response.status).toBe(400);
    });

    it("rejects a missing year", async () => {
      const payload = validPayload();
      delete (payload as any).year;

      const response = await request(app).post(baseUrl).set("Authorization", `Bearer ${token}`).send(payload);
      expect(response.status).toBe(400);
    });

    it("rejects a missing categoryId", async () => {
      const payload = validPayload();
      delete (payload as any).categoryId;

      const response = await request(app).post(baseUrl).set("Authorization", `Bearer ${token}`).send(payload);
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

    it("associates the created budget with the authenticated user", async () => {
      const response = await request(app).post(baseUrl).set("Authorization", `Bearer ${token}`).send(validPayload());

      const budget = await prisma.budget.findUnique({ where: { id: response.body.id } });
      expect(budget?.userId).toBe(userId);
    });
  });

  describe("edge cases", () => {
    it("handles a very large amount without corrupting the value", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ amount: 999_999_999 }));

      expect(response.status).toBe(201);
      expect(response.body.amount).toBe(999_999_999);
    });

    it("handles a decimal amount correctly", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ amount: 250.75 }));

      expect(response.status).toBe(201);
      expect(response.body.amount).toBeCloseTo(250.75, 2);
    });

    it("allows creating multiple budgets for the same user across different periods and categories", async () => {
      const secondCategory = await createCategory(userId, { name: "Entertainment" });

      await request(app).post(baseUrl).set("Authorization", `Bearer ${token}`).send(validPayload({ categoryId, month: 1 }));
      await request(app).post(baseUrl).set("Authorization", `Bearer ${token}`).send(validPayload({ categoryId, month: 2 }));
      await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ categoryId: secondCategory.id, month: 1 }));

      const budgets = await prisma.budget.findMany({ where: { userId } });
      expect(budgets.length).toBe(3);
    });
  });
});