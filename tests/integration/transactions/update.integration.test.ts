import request from "supertest";
import { randomUUID } from "crypto";
import { AccountType, CategoryType, TransactionType } from "@prisma/client";
import { prisma } from "../../../src/config/prisma.js";
import app from "../../../src/app.js";
import { generateToken } from "../../../src/utils/generateToken.js";

describe("PATCH /transactions/:id integration tests", () => {
  let userId: string;
  let token: string;
  let accountId: string;
  let secondAccountId: string;
  let categoryId: string;
  let otherUserId: string;
  let otherUserToken: string;
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
      data: {
        name: `User ${email}`,
        email,
        password: "hashed-password",
      },
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

  const applyTransactionToAccountBalance = async (accountId: string, transactionType: TransactionType, amount: number) => {
    const account = await prisma.account.findUnique({ where: { id: accountId } });

    if (!account) {
      throw new Error("Account not found while applying transaction balance");
    }

    const isCredit = account.type === AccountType.CREDIT_CARD;
    let nextBalance: number;

    if (transactionType === TransactionType.EXPENSE) {
      nextBalance = isCredit ? account.balance + amount : account.balance - amount;
    } else {
      nextBalance = isCredit ? account.balance - amount : account.balance + amount;
    }

    if (account.type === AccountType.CREDIT_CARD) {
      if (nextBalance > account.creditLimit!) {
        throw new Error("Credit limit exceeded");
      }
      if (nextBalance < 0) {
        throw new Error("Payment exceeds current debt");
      }
    } else if (nextBalance < 0) {
      throw new Error("Insufficient balance");
    }

    await prisma.account.update({
      where: { id: accountId },
      data: { balance: nextBalance },
    });
  };

  const createTransaction = async (accountId: string, categoryId: string, overrides: Partial<any> = {}) => {
    const transaction = await prisma.transaction.create({
      data: {
        amount: overrides.amount ?? 100,
        description: overrides.description ?? "Initial transaction",
        type: overrides.type ?? TransactionType.EXPENSE,
        date: overrides.date ?? new Date("2025-01-10T10:00:00.000Z"),
        accountId,
        categoryId,
      },
    });

    await applyTransactionToAccountBalance(accountId, transaction.type, transaction.amount);

    return transaction;
  };

  beforeEach(async () => {
    await cleanDatabase();

    const owner = await createUser("owner@example.com");
    userId = owner.id;
    token = generateToken(userId);

    const secondOwner = await createUser("other-user@example.com");
    otherUserId = secondOwner.id;
    otherUserToken = generateToken(otherUserId);

    accountId = (await createAccount(userId, { name: "Checking", balance: 1000, type: AccountType.BANK_ACCOUNT })).id;
    secondAccountId = (await createAccount(userId, { name: "Savings", balance: 500, type: AccountType.BANK_ACCOUNT })).id;
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

  describe("successful updates", () => {
    it("updates only the description and preserves balance", async () => {
      const transaction = await createTransaction(accountId, categoryId, { amount: 100, description: "Lunch" });

      const response = await request(app)
        .patch(`${baseUrl}/${transaction.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ description: "Updated lunch" });

      expect(response.status).toBe(200);
      expect(response.body.description).toBe("Updated lunch");

      const account = await prisma.account.findUnique({ where: { id: accountId } });
      expect(account?.balance).toBe(900);
    });

    it("updates only the date", async () => {
      const transaction = await createTransaction(accountId, categoryId, { amount: 150 });
      const newDate = new Date("2026-02-15T08:30:00.000Z");

      const response = await request(app)
        .patch(`${baseUrl}/${transaction.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ date: newDate.toISOString() });

      expect(response.status).toBe(200);
      expect(new Date(response.body.date).toISOString()).toBe(newDate.toISOString());

      const account = await prisma.account.findUnique({ where: { id: accountId } });
      expect(account?.balance).toBe(850);
    });

    it("updates only the category", async () => {
      const anotherCategory = await createCategory(userId, { name: "Utilities" });
      const transaction = await createTransaction(accountId, categoryId, { amount: 80 });

      const response = await request(app)
        .patch(`${baseUrl}/${transaction.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ categoryId: anotherCategory.id });

      expect(response.status).toBe(200);
      expect(response.body.categoryId).toBe(anotherCategory.id);

      const account = await prisma.account.findUnique({ where: { id: accountId } });
      expect(account?.balance).toBe(920);
    });

    it("updates only the amount to a larger value", async () => {
      const transaction = await createTransaction(accountId, categoryId, { amount: 100 });

      const response = await request(app)
        .patch(`${baseUrl}/${transaction.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: 200 });

      expect(response.status).toBe(200);
      expect(response.body.amount).toBe(200);

      const account = await prisma.account.findUnique({ where: { id: accountId } });
      expect(account?.balance).toBe(800);
    });

    it("updates only the amount to a smaller value", async () => {
      const transaction = await createTransaction(accountId, categoryId, { amount: 200 });

      const response = await request(app)
        .patch(`${baseUrl}/${transaction.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: 50 });

      expect(response.status).toBe(200);
      expect(response.body.amount).toBe(50);

      const account = await prisma.account.findUnique({ where: { id: accountId } });
      expect(account?.balance).toBe(950);
    });

    it("changes only the transaction type", async () => {
      const transaction = await createTransaction(accountId, categoryId, { amount: 100, type: TransactionType.EXPENSE });

      const response = await request(app)
        .patch(`${baseUrl}/${transaction.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ type: TransactionType.INCOME });

      expect(response.status).toBe(200);
      expect(response.body.type).toBe(TransactionType.INCOME);

      const account = await prisma.account.findUnique({ where: { id: accountId } });
      expect(account?.balance).toBe(1100);
    });

    it("changes only the account", async () => {
      const transaction = await createTransaction(accountId, categoryId, { amount: 100 });

      const response = await request(app)
        .patch(`${baseUrl}/${transaction.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ accountId: secondAccountId });

      expect(response.status).toBe(200);
      expect(response.body.accountId).toBe(secondAccountId);

      const firstAccount = await prisma.account.findUnique({ where: { id: accountId } });
      const second = await prisma.account.findUnique({ where: { id: secondAccountId } });
      // type sigue siendo EXPENSE (no cambió), así que mover la transacción resta 100 en la cuenta destino
      expect(firstAccount?.balance).toBe(1000);
      expect(second?.balance).toBe(400);
    });
  });

  describe("combined updates", () => {
    it("changes account and amount", async () => {
      const transaction = await createTransaction(accountId, categoryId, { amount: 150, type: TransactionType.EXPENSE });

      const response = await request(app)
        .patch(`${baseUrl}/${transaction.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ accountId: secondAccountId, amount: 250 });

      expect(response.status).toBe(200);
      expect(response.body.amount).toBe(250);
      expect(response.body.accountId).toBe(secondAccountId);

      const firstAccount = await prisma.account.findUnique({ where: { id: accountId } });
      const second = await prisma.account.findUnique({ where: { id: secondAccountId } });
      expect(firstAccount?.balance).toBe(1000);
      expect(second?.balance).toBe(250);
    });

    it("changes account and type", async () => {
      const transaction = await createTransaction(accountId, categoryId, { amount: 100, type: TransactionType.EXPENSE });

      const response = await request(app)
        .patch(`${baseUrl}/${transaction.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ accountId: secondAccountId, type: TransactionType.INCOME });

      expect(response.status).toBe(200);
      expect(response.body.type).toBe(TransactionType.INCOME);

      const firstAccount = await prisma.account.findUnique({ where: { id: accountId } });
      const second = await prisma.account.findUnique({ where: { id: secondAccountId } });
      expect(firstAccount?.balance).toBe(1000);
      expect(second?.balance).toBe(600);
    });

    it("changes account and category", async () => {
      const anotherCategory = await createCategory(userId, { name: "Transport" });
      const transaction = await createTransaction(accountId, categoryId, { amount: 90 });

      const response = await request(app)
        .patch(`${baseUrl}/${transaction.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ accountId: secondAccountId, categoryId: anotherCategory.id });

      expect(response.status).toBe(200);
      expect(response.body.categoryId).toBe(anotherCategory.id);

      const firstAccount = await prisma.account.findUnique({ where: { id: accountId } });
      const second = await prisma.account.findUnique({ where: { id: secondAccountId } });
      expect(firstAccount?.balance).toBe(1000);
      expect(second?.balance).toBe(410);
    });

    it("changes type and amount", async () => {
      const transaction = await createTransaction(accountId, categoryId, { amount: 100, type: TransactionType.EXPENSE });

      const response = await request(app)
        .patch(`${baseUrl}/${transaction.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ type: TransactionType.INCOME, amount: 50 });

      expect(response.status).toBe(200);
      expect(response.body.type).toBe(TransactionType.INCOME);
      expect(response.body.amount).toBe(50);

      const account = await prisma.account.findUnique({ where: { id: accountId } });
      expect(account?.balance).toBe(1050);
    });

    it("changes account, type and amount together", async () => {
      const transaction = await createTransaction(accountId, categoryId, { amount: 100, type: TransactionType.EXPENSE });

      const response = await request(app)
        .patch(`${baseUrl}/${transaction.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ accountId: secondAccountId, type: TransactionType.INCOME, amount: 60 });

      expect(response.status).toBe(200);
      expect(response.body.accountId).toBe(secondAccountId);
      expect(response.body.type).toBe(TransactionType.INCOME);
      expect(response.body.amount).toBe(60);

      const firstAccount = await prisma.account.findUnique({ where: { id: accountId } });
      const second = await prisma.account.findUnique({ where: { id: secondAccountId } });
      expect(firstAccount?.balance).toBe(1000);
      expect(second?.balance).toBe(560);
    });

    it("changes every field at once", async () => {
      const transaction = await createTransaction(accountId, categoryId, { amount: 120, description: "Old", type: TransactionType.EXPENSE, date: new Date("2025-01-10T10:00:00.000Z") });
      const newCategory = await createCategory(userId, { name: "Rent" });

      const response = await request(app)
        .patch(`${baseUrl}/${transaction.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          amount: 80,
          description: "Fresh",
          type: TransactionType.INCOME,
          date: "2026-04-20T12:30:00.000Z",
          accountId: secondAccountId,
          categoryId: newCategory.id,
        });

      expect(response.status).toBe(200);
      expect(response.body.amount).toBe(80);
      expect(response.body.description).toBe("Fresh");
      expect(response.body.type).toBe(TransactionType.INCOME);
      expect(response.body.accountId).toBe(secondAccountId);
      expect(response.body.categoryId).toBe(newCategory.id);

      const firstAccount = await prisma.account.findUnique({ where: { id: accountId } });
      const second = await prisma.account.findUnique({ where: { id: secondAccountId } });
      expect(firstAccount?.balance).toBe(1000);
      expect(second?.balance).toBe(580);
    });
  });

  describe("business rule validations", () => {
    it("rejects updates that would make a cash account balance negative", async () => {
      const transaction = await createTransaction(accountId, categoryId, { amount: 100 });

      const response = await request(app)
        .patch(`${baseUrl}/${transaction.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: 2000 });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Insufficient balance");
    });

    it("rejects updates that exceed the credit card limit", async () => {
      const creditAccount = await createAccount(userId, {
        name: "Credit",
        balance: 0,
        creditLimit: 500,
        type: AccountType.CREDIT_CARD,
      });
      const creditCategory = await createCategory(userId, { name: "Card expenses" });
      const transaction = await createTransaction(creditAccount.id, creditCategory.id, { amount: 50, type: TransactionType.EXPENSE });

      const response = await request(app)
        .patch(`${baseUrl}/${transaction.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: 600 });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Credit limit exceeded");
    });

    it("rejects payments larger than the current debt", async () => {
      const creditAccount = await createAccount(userId, {
        name: "Credit",
        balance: 80,
        creditLimit: 500,
        type: AccountType.CREDIT_CARD,
      });
      const creditCategory = await createCategory(userId, { name: "Card expenses" });
      const transaction = await createTransaction(creditAccount.id, creditCategory.id, { amount: 50, type: TransactionType.EXPENSE });

      const response = await request(app)
        .patch(`${baseUrl}/${transaction.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ type: TransactionType.INCOME, amount: 1000 });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Payment exceeds current debt");
    });

    it("rejects updates for an account that does not exist", async () => {
      const transaction = await createTransaction(accountId, categoryId, { amount: 100 });

      const response = await request(app)
        .patch(`${baseUrl}/${transaction.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ accountId: randomUUID() });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Account not found");
    });

    it("rejects updates for an account belonging to another user", async () => {
      const transaction = await createTransaction(accountId, categoryId, { amount: 100 });

      const response = await request(app)
        .patch(`${baseUrl}/${transaction.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ accountId: otherAccountId });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Account not found or does not belong to the user");
    });

    it("rejects updates for a category that does not exist", async () => {
      const transaction = await createTransaction(accountId, categoryId, { amount: 100 });

      const response = await request(app)
        .patch(`${baseUrl}/${transaction.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ categoryId: randomUUID() });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Category not found");
    });

    it("rejects updates for a category belonging to another user", async () => {
      const transaction = await createTransaction(accountId, categoryId, { amount: 100 });

      const response = await request(app)
        .patch(`${baseUrl}/${transaction.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ categoryId: otherCategoryId });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Category not found or does not belong to the user");
    });

    it("rejects updates for a nonexistent transaction", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/00000000-0000-0000-0000-000000000000`)
        .set("Authorization", `Bearer ${token}`)
        .send({ description: "Fail" });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Transaction not found");
    });

    it("rejects an empty update body", async () => {
      const transaction = await createTransaction(accountId, categoryId, { amount: 100 });

      const response = await request(app)
        .patch(`${baseUrl}/${transaction.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("At least one field must be provided for update");
    });
  });

  describe("input validation", () => {
    it("rejects a negative amount", async () => {
      const transaction = await createTransaction(accountId, categoryId, { amount: 100 });

      const response = await request(app)
        .patch(`${baseUrl}/${transaction.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: -10 });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Amount must be greater than 0");
    });

    it("rejects an amount equal to zero", async () => {
      const transaction = await createTransaction(accountId, categoryId, { amount: 100 });

      const response = await request(app)
        .patch(`${baseUrl}/${transaction.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: 0 });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Amount must be greater than 0");
    });

    it("rejects an invalid transaction type", async () => {
      const transaction = await createTransaction(accountId, categoryId, { amount: 100 });

      const response = await request(app)
        .patch(`${baseUrl}/${transaction.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ type: "INVALID" });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Type must be one of the following: INCOME, EXPENSE");
    });

    it("rejects an invalid date", async () => {
      const transaction = await createTransaction(accountId, categoryId, { amount: 100 });

      const response = await request(app)
        .patch(`${baseUrl}/${transaction.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ date: "not-a-date" });

      expect(response.status).toBe(400);
    });
  });

  describe("edge cases and regression scenarios", () => {
    it("handles a change from 1 to 2 correctly", async () => {
      const transaction = await createTransaction(accountId, categoryId, { amount: 1 });

      const response = await request(app)
        .patch(`${baseUrl}/${transaction.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: 2 });

      expect(response.status).toBe(200);
      expect(response.body.amount).toBe(2);

      const account = await prisma.account.findUnique({ where: { id: accountId } });
      expect(account?.balance).toBe(998);
    });

    it("handles very large amounts without corrupting the account balance", async () => {
      const transaction = await createTransaction(accountId, categoryId, { amount: 100 });

      const response = await request(app)
        .patch(`${baseUrl}/${transaction.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: 1000000000 });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Insufficient balance");
    });

    it("allows updating to the same account without breaking the balance", async () => {
      const transaction = await createTransaction(accountId, categoryId, { amount: 100 });

      const response = await request(app)
        .patch(`${baseUrl}/${transaction.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ accountId, amount: 120 });

      expect(response.status).toBe(200);
      const account = await prisma.account.findUnique({ where: { id: accountId } });
      expect(account?.balance).toBe(880);
    });

    it("supports repeated updates on the same transaction without drift", async () => {
      const transaction = await createTransaction(accountId, categoryId, { amount: 100 });

      await request(app)
        .patch(`${baseUrl}/${transaction.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: 120 });

      await request(app)
        .patch(`${baseUrl}/${transaction.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: 90 });

      const account = await prisma.account.findUnique({ where: { id: accountId } });
      expect(account?.balance).toBe(910);
    });

    it("keeps the final balance consistent after create, update, update and delete", async () => {
      const transaction = await createTransaction(accountId, categoryId, { amount: 100, type: TransactionType.EXPENSE });

      await request(app)
        .patch(`${baseUrl}/${transaction.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: 60 });

      await request(app)
        .patch(`${baseUrl}/${transaction.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: 80 });

      await request(app)
        .delete(`${baseUrl}/${transaction.id}`)
        .set("Authorization", `Bearer ${token}`);

      const account = await prisma.account.findUnique({ where: { id: accountId } });
      expect(account?.balance).toBe(1000);
    });

    it("keeps the balance aligned with the sum of all transactions", async () => {
      const initialAccount = await prisma.account.findUnique({ where: { id: accountId } });
      const initialBalance = initialAccount!.balance;

      const first = await createTransaction(accountId, categoryId, { amount: 100, type: TransactionType.EXPENSE });
      await createTransaction(accountId, categoryId, { amount: 50, type: TransactionType.INCOME });

      await request(app)
        .patch(`${baseUrl}/${first.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ amount: 70 });

      const transactions = await prisma.transaction.findMany({ where: { accountId } });
      const netEffect = transactions.reduce((sum, item) => sum + (item.type === TransactionType.EXPENSE ? -item.amount : item.amount), 0);

      const account = await prisma.account.findUnique({ where: { id: accountId } });
      expect(account?.balance).toBe(initialBalance + netEffect);
    });
  });

  describe("authorization and ownership checks", () => {
    it("rejects updates for a transaction owned by another user", async () => {
      const otherUserTransaction = await prisma.transaction.create({
        data: {
          amount: 100,
          description: "Other",
          type: TransactionType.EXPENSE,
          date: new Date("2025-01-10T10:00:00.000Z"),
          accountId: otherAccountId,
          categoryId: otherCategoryId,
        },
      });

      const response = await request(app)
        .patch(`${baseUrl}/${otherUserTransaction.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ description: "Should fail" });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Unauthorized access to this transaction");
    });
  });
});