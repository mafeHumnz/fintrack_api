import request from "supertest";
import { AccountType, CategoryType, TransactionType } from "@prisma/client";
import { prisma } from "../../../src/config/prisma.js";
import app from "../../../src/app.js";
import { generateToken } from "../../../src/utils/generateToken.js";

describe("DELETE /accounts/:id integration tests", () => {
  let userId: string;
  let token: string;
  let otherUserId: string;
  let otherToken: string;
  let bankAccountId: string;
  let creditAccountId: string;
  let otherAccountId: string;
  let categoryId: string;

  const baseUrl = "/accounts";

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
        creditLimit: overrides.creditLimit ?? null,
        currency: overrides.currency ?? "USD",
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

  const createTransaction = async (accountId: string, categoryId: string, overrides: Partial<any> = {}) => {
    return prisma.transaction.create({
      data: {
        amount: overrides.amount ?? 100,
        description: overrides.description ?? "Test transaction",
        type: overrides.type ?? TransactionType.EXPENSE,
        date: overrides.date ?? new Date("2025-01-10T10:00:00.000Z"),
        accountId,
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

    bankAccountId = (await createAccount(userId, { name: "Checking", balance: 1000, type: AccountType.BANK_ACCOUNT })).id;
    creditAccountId = (
      await createAccount(userId, { name: "Visa", balance: 200, creditLimit: 5000, type: AccountType.CREDIT_CARD })
    ).id;
    categoryId = (await createCategory(userId, { name: "Food" })).id;

    otherAccountId = (await createAccount(otherUserId, { name: "Other account", balance: 1000 })).id;
  });

  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("successful deletion", () => {
    it("deletes an account with no associated transactions", async () => {
      const response = await request(app)
        .delete(`${baseUrl}/${bankAccountId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("Account deleted successfully");
    });

    it("removes the account from the database", async () => {
      await request(app).delete(`${baseUrl}/${bankAccountId}`).set("Authorization", `Bearer ${token}`);

      const account = await prisma.account.findUnique({ where: { id: bankAccountId } });
      expect(account).toBeNull();
    });

    it("deletes a CASH account with no transactions", async () => {
      const cashAccount = await createAccount(userId, { name: "Wallet", type: AccountType.CASH, balance: 300 });

      const response = await request(app)
        .delete(`${baseUrl}/${cashAccount.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
    });

    it("deletes a CREDIT_CARD account with no transactions", async () => {
      const response = await request(app)
        .delete(`${baseUrl}/${creditAccountId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);

      const account = await prisma.account.findUnique({ where: { id: creditAccountId } });
      expect(account).toBeNull();
    });
  });

  describe("business rule validations", () => {
    it("rejects deleting an account that has an associated transaction", async () => {
      await createTransaction(bankAccountId, categoryId, { amount: 100 });

      const response = await request(app)
        .delete(`${baseUrl}/${bankAccountId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Cannot delete account with existing transactions");

      const account = await prisma.account.findUnique({ where: { id: bankAccountId } });
      expect(account).not.toBeNull(); // account was not deleted
    });

    it("rejects deleting an account with multiple associated transactions", async () => {
      await createTransaction(bankAccountId, categoryId, { amount: 100, type: TransactionType.EXPENSE });
      await createTransaction(bankAccountId, categoryId, { amount: 50, type: TransactionType.INCOME });

      const response = await request(app)
        .delete(`${baseUrl}/${bankAccountId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Cannot delete account with existing transactions");

      const remainingTransactions = await prisma.transaction.findMany({ where: { accountId: bankAccountId } });
      expect(remainingTransactions.length).toBe(2); // transactions untouched
    });

    it("allows deleting an account after all its transactions have been removed", async () => {
      const transaction = await createTransaction(bankAccountId, categoryId, { amount: 100 });

      await prisma.transaction.delete({ where: { id: transaction.id } });

      const response = await request(app)
        .delete(`${baseUrl}/${bankAccountId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
    });

    it("does not raise a raw database error when blocking deletion (message is clean, not a Prisma error)", async () => {
      await createTransaction(bankAccountId, categoryId, { amount: 100 });

      const response = await request(app)
        .delete(`${baseUrl}/${bankAccountId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.message).not.toContain("Prisma");
      expect(response.body.message).not.toContain("foreign key");
    });
  });

  describe("ownership and authorization", () => {
    it("rejects deleting a nonexistent account", async () => {
      const response = await request(app)
        .delete(`${baseUrl}/00000000-0000-4000-8000-000000000000`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Account not found");
    });

    it("rejects a malformed account id", async () => {
      const response = await request(app)
        .delete(`${baseUrl}/not-a-uuid`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(400);
    });

    it("rejects deleting an account belonging to another user", async () => {
      const response = await request(app)
        .delete(`${baseUrl}/${otherAccountId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Unauthorized access");

      const account = await prisma.account.findUnique({ where: { id: otherAccountId } });
      expect(account).not.toBeNull(); // not deleted
    });

    it("rejects requests without an auth token", async () => {
      const response = await request(app).delete(`${baseUrl}/${bankAccountId}`);
      expect(response.status).toBe(401);
    });
  });

  describe("edge cases and regression scenarios", () => {
    it("deletes only the targeted account, leaving other accounts of the same user intact", async () => {
      await request(app).delete(`${baseUrl}/${bankAccountId}`).set("Authorization", `Bearer ${token}`);

      const untouched = await prisma.account.findUnique({ where: { id: creditAccountId } });
      expect(untouched).not.toBeNull();
    });

    it("keeps accounts isolated between two different users when deleting", async () => {
      await request(app).delete(`${baseUrl}/${otherAccountId}`).set("Authorization", `Bearer ${otherToken}`);

      const own = await prisma.account.findUnique({ where: { id: bankAccountId } });
      expect(own).not.toBeNull(); // unaffected by another user's deletion
    });

    it("rejects deleting the same account twice", async () => {
      const first = await request(app).delete(`${baseUrl}/${bankAccountId}`).set("Authorization", `Bearer ${token}`);
      const second = await request(app).delete(`${baseUrl}/${bankAccountId}`).set("Authorization", `Bearer ${token}`);

      expect(first.status).toBe(200);
      expect(second.status).toBe(400);
      expect(second.body.message).toContain("Account not found");
    });

    it("allows deleting multiple different accounts sequentially", async () => {
      const first = await request(app).delete(`${baseUrl}/${bankAccountId}`).set("Authorization", `Bearer ${token}`);
      const second = await request(app).delete(`${baseUrl}/${creditAccountId}`).set("Authorization", `Bearer ${token}`);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);

      const remaining = await prisma.account.findMany({ where: { userId } });
      expect(remaining.length).toBe(0);
    });

    it("does not affect the account name uniqueness constraint after deletion (name becomes reusable)", async () => {
      await request(app).delete(`${baseUrl}/${bankAccountId}`).set("Authorization", `Bearer ${token}`);

      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Checking", balance: 500, currency: "USD", type: AccountType.BANK_ACCOUNT });

      expect(response.status).toBe(201);
    });
  });
});