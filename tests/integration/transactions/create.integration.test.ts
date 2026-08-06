import request from "supertest";
import { AccountType, CategoryType, TransactionType } from "@prisma/client";
import { prisma } from "../../../src/config/prisma.js";
import app from "../../../src/app.js";
import { generateToken } from "../../../src/utils/generateToken.js";

describe("POST /transactions integration tests", () => {
  let userId: string;
  let token: string;
  let cashAccountId: string;
  let bankAccountId: string;
  let creditAccountId: string;
  let categoryId: string;
  let otherUserId: string;
  let otherAccountId: string;
  let otherCategoryId: string;

  const baseUrl = "/transactions";

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

  const createAccount = async (userId: string, overrides: Partial<any> = {}) => {
    return prisma.account.create({
      data: {
        name: overrides.name ?? "Primary account",
        balance: overrides.balance ?? 1000,
        creditLimit: overrides.creditLimit ?? 5000,
        type: overrides.type ?? AccountType.BANK_ACCOUNT,
        userId,
      },
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
    amount: overrides.amount ?? 100,
    description: overrides.description ?? "Test transaction",
    type: overrides.type ?? TransactionType.EXPENSE,
    date: overrides.date ?? new Date("2025-01-10T10:00:00.000Z").toISOString(),
    accountId: overrides.accountId ?? bankAccountId,
    categoryId: overrides.categoryId ?? categoryId,
  });

  beforeEach(async () => {
    await cleanDatabase();

    const owner = await createUser("owner@example.com");
    userId = owner.id;
    token = generateToken(userId);

    const otherOwner = await createUser("other@example.com");
    otherUserId = otherOwner.id;

    cashAccountId = (await createAccount(userId, { name: "Cash", balance: 1000, type: AccountType.CASH })).id;
    bankAccountId = (await createAccount(userId, { name: "Bank", balance: 1000, type: AccountType.BANK_ACCOUNT })).id;
    creditAccountId = (
      await createAccount(userId, { name: "Credit", balance: 0, creditLimit: 500, type: AccountType.CREDIT_CARD })
    ).id;
    categoryId = (await createCategory(userId, { name: "Food" })).id;

    otherAccountId = (await createAccount(otherUserId, { name: "Other account", balance: 1000, type: AccountType.BANK_ACCOUNT })).id;
    otherCategoryId = (await createCategory(otherUserId, { name: "Other category" })).id;
  });

  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("successful creation", () => {
    it("creates a transaction for a CASH account and updates its balance", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ accountId: cashAccountId, amount: 200, type: TransactionType.EXPENSE }));

      expect(response.status).toBe(201);
      expect(response.body.accountId).toBe(cashAccountId);

      const account = await prisma.account.findUnique({ where: { id: cashAccountId } });
      expect(account?.balance).toBe(800);
    });

    it("creates a transaction for a BANK_ACCOUNT and updates its balance", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ accountId: bankAccountId, amount: 300, type: TransactionType.INCOME }));

      expect(response.status).toBe(201);

      const account = await prisma.account.findUnique({ where: { id: bankAccountId } });
      expect(account?.balance).toBe(1300);
    });

    it("creates an EXPENSE transaction for a CREDIT_CARD account, increasing debt", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ accountId: creditAccountId, amount: 150, type: TransactionType.EXPENSE }));

      expect(response.status).toBe(201);

      const account = await prisma.account.findUnique({ where: { id: creditAccountId } });
      expect(account?.balance).toBe(150);
    });

    it("creates an INCOME (payment) transaction for a CREDIT_CARD account, decreasing debt", async () => {
      await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ accountId: creditAccountId, amount: 200, type: TransactionType.EXPENSE }));

      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ accountId: creditAccountId, amount: 80, type: TransactionType.INCOME }));

      expect(response.status).toBe(201);

      const account = await prisma.account.findUnique({ where: { id: creditAccountId } });
      expect(account?.balance).toBe(120);
    });
  });

  describe("business rule validations", () => {
    it("rejects an EXPENSE that exceeds the CASH account balance", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ accountId: cashAccountId, amount: 5000, type: TransactionType.EXPENSE }));

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Insufficient balance");

      const account = await prisma.account.findUnique({ where: { id: cashAccountId } });
      expect(account?.balance).toBe(1000); // unchanged
    });

    it("rejects an EXPENSE that exceeds the BANK_ACCOUNT balance", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ accountId: bankAccountId, amount: 5000, type: TransactionType.EXPENSE }));

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Insufficient balance");
    });

    it("rejects an EXPENSE that exceeds the credit card limit", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ accountId: creditAccountId, amount: 600, type: TransactionType.EXPENSE }));

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Credit limit exceeded");

      const account = await prisma.account.findUnique({ where: { id: creditAccountId } });
      expect(account?.balance).toBe(0); // unchanged
    });

    it("rejects a credit card payment (INCOME) larger than the current debt", async () => {
      await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ accountId: creditAccountId, amount: 100, type: TransactionType.EXPENSE }));

      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ accountId: creditAccountId, amount: 500, type: TransactionType.INCOME }));

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Payment exceeds current debt");

      const account = await prisma.account.findUnique({ where: { id: creditAccountId } });
      expect(account?.balance).toBe(100); // unchanged after rejected payment
    });

    it("rejects a transaction for a nonexistent account", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ accountId: "11111111-1111-4111-8111-111111111111" }));

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Account not found");
    });

    it("rejects a transaction for an account belonging to another user", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ accountId: otherAccountId }));

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Account not found or does not belong to the user");
    });

    it("rejects a transaction for a nonexistent category", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ categoryId: "22222222-2222-4222-8222-222222222222" }));

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Category not found");
    });

    it("rejects a transaction for a category belonging to another user", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ categoryId: otherCategoryId }));

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Category not found or does not belong to the user");
    });

    it("does not create a transaction record when balance validation fails", async () => {
      await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ accountId: cashAccountId, amount: 5000, type: TransactionType.EXPENSE }));

      const transactions = await prisma.transaction.findMany({ where: { accountId: cashAccountId } });
      expect(transactions.length).toBe(0);
    });
  });

  describe("input validation", () => {
    it("rejects a negative amount", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ amount: -50 }));

      expect(response.status).toBe(400);
    });

    it("rejects an amount equal to zero", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ amount: 0 }));

      expect(response.status).toBe(400);
    });

    it("rejects an invalid transaction type", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ type: "INVALID" }));

      expect(response.status).toBe(400);
    });

    it("rejects an invalid date", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ date: "not-a-date" }));

      expect(response.status).toBe(400);
    });

    it("rejects a malformed accountId (not a UUID)", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ accountId: "not-a-uuid" }));

      expect(response.status).toBe(400);
    });

    it("rejects missing amount", async () => {
      const payload = validPayload();
      delete (payload as any).amount;

      const response = await request(app).post(baseUrl).set("Authorization", `Bearer ${token}`).send(payload);
      expect(response.status).toBe(400);
    });

    it("rejects missing type", async () => {
      const payload = validPayload();
      delete (payload as any).type;

      const response = await request(app).post(baseUrl).set("Authorization", `Bearer ${token}`).send(payload);
      expect(response.status).toBe(400);
    });

    it("rejects missing accountId", async () => {
      const payload = validPayload();
      delete (payload as any).accountId;

      const response = await request(app).post(baseUrl).set("Authorization", `Bearer ${token}`).send(payload);
      expect(response.status).toBe(400);
    });

    it("rejects missing categoryId", async () => {
      const payload = validPayload();
      delete (payload as any).categoryId;

      const response = await request(app).post(baseUrl).set("Authorization", `Bearer ${token}`).send(payload);
      expect(response.status).toBe(400);
    });

    it("rejects missing description (required by schema)", async () => {
      const payload = validPayload();
      delete (payload as any).description;

      const response = await request(app).post(baseUrl).set("Authorization", `Bearer ${token}`).send(payload);
      expect(response.status).toBe(400);
    });

    it("rejects an empty request body", async () => {
      const response = await request(app).post(baseUrl).set("Authorization", `Bearer ${token}`).send({});
      expect(response.status).toBe(400);
    });

    it("rejects requests without an auth token", async () => {
      const response = await request(app).post(baseUrl).send(validPayload());
      expect(response.status).toBe(401);
    });
  });

  describe("edge cases", () => {
    it("accepts the minimum valid amount (0.01)", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ amount: 0.01, accountId: bankAccountId }));

      expect(response.status).toBe(201);

      const account = await prisma.account.findUnique({ where: { id: bankAccountId } });
      expect(account?.balance).toBeCloseTo(999.99, 2);
    });

    it("rejects a very large amount that exceeds the account balance", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ amount: 1_000_000_000, accountId: bankAccountId, type: TransactionType.EXPENSE }));

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Insufficient balance");
    });

    it("accepts a very large INCOME amount without corrupting the balance", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ amount: 1_000_000, accountId: bankAccountId, type: TransactionType.INCOME }));

      expect(response.status).toBe(201);

      const account = await prisma.account.findUnique({ where: { id: bankAccountId } });
      expect(account?.balance).toBe(1_001_000);
    });

    it("keeps balance consistent after multiple sequential transactions", async () => {
      await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ accountId: bankAccountId, amount: 200, type: TransactionType.EXPENSE }));

      await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ accountId: bankAccountId, amount: 150, type: TransactionType.INCOME }));

      await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ accountId: bankAccountId, amount: 50, type: TransactionType.EXPENSE }));

      // 1000 - 200 + 150 - 50 = 900
      const account = await prisma.account.findUnique({ where: { id: bankAccountId } });
      expect(account?.balance).toBe(900);
    });

    it("keeps two accounts independent when creating transactions on both", async () => {
      await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ accountId: cashAccountId, amount: 100, type: TransactionType.EXPENSE }));

      await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ accountId: bankAccountId, amount: 300, type: TransactionType.EXPENSE }));

      const cash = await prisma.account.findUnique({ where: { id: cashAccountId } });
      const bank = await prisma.account.findUnique({ where: { id: bankAccountId } });

      expect(cash?.balance).toBe(900);
      expect(bank?.balance).toBe(700);
    });
  });
});