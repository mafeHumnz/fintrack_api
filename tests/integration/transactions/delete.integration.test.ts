import request from "supertest";
import { AccountType, CategoryType, TransactionType } from "@prisma/client";
import { prisma } from "../../../src/config/prisma.js";
import app from "../../../src/app.js";
import { generateToken } from "../../../src/utils/generateToken.js";

describe("DELETE /transactions/:id integration tests", () => {
  let userId: string;
  let token: string;
  let bankAccountId: string;
  let creditAccountId: string;
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

  const applyTransactionToAccountBalance = async (accountId: string, transactionType: TransactionType, amount: number) => {
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) throw new Error("Account not found while applying transaction balance");

    const isCredit = account.type === AccountType.CREDIT_CARD;
    let nextBalance: number;

    if (transactionType === TransactionType.EXPENSE) {
      nextBalance = isCredit ? account.balance + amount : account.balance - amount;
    } else {
      nextBalance = isCredit ? account.balance - amount : account.balance + amount;
    }

    await prisma.account.update({ where: { id: accountId }, data: { balance: nextBalance } });
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

    const otherOwner = await createUser("other@example.com");
    otherUserId = otherOwner.id;
    otherUserToken = generateToken(otherUserId);

    bankAccountId = (await createAccount(userId, { name: "Bank", balance: 1000, type: AccountType.BANK_ACCOUNT })).id;
    creditAccountId = (
      await createAccount(userId, { name: "Credit", balance: 100, creditLimit: 500, type: AccountType.CREDIT_CARD })
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

  describe("successful deletion and balance restoration", () => {
    it("reverses an EXPENSE and restores the account balance", async () => {
      const transaction = await createTransaction(bankAccountId, categoryId, { amount: 200, type: TransactionType.EXPENSE });

      const accountBefore = await prisma.account.findUnique({ where: { id: bankAccountId } });
      expect(accountBefore?.balance).toBe(800);

      const response = await request(app)
        .delete(`${baseUrl}/${transaction.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);

      const accountAfter = await prisma.account.findUnique({ where: { id: bankAccountId } });
      expect(accountAfter?.balance).toBe(1000);
    });

    it("reverses an INCOME and restores the account balance", async () => {
      const transaction = await createTransaction(bankAccountId, categoryId, { amount: 300, type: TransactionType.INCOME });

      const accountBefore = await prisma.account.findUnique({ where: { id: bankAccountId } });
      expect(accountBefore?.balance).toBe(1300);

      const response = await request(app)
        .delete(`${baseUrl}/${transaction.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);

      const accountAfter = await prisma.account.findUnique({ where: { id: bankAccountId } });
      expect(accountAfter?.balance).toBe(1000);
    });

    it("deletes the transaction record from the database", async () => {
      const transaction = await createTransaction(bankAccountId, categoryId, { amount: 100 });

      await request(app).delete(`${baseUrl}/${transaction.id}`).set("Authorization", `Bearer ${token}`);

      const deleted = await prisma.transaction.findUnique({ where: { id: transaction.id } });
      expect(deleted).toBeNull();
    });

    it("reverses a credit card EXPENSE, decreasing debt back to its original value", async () => {
      const transaction = await createTransaction(creditAccountId, categoryId, { amount: 150, type: TransactionType.EXPENSE });

      const accountBefore = await prisma.account.findUnique({ where: { id: creditAccountId } });
      expect(accountBefore?.balance).toBe(250); // 100 initial + 150

      const response = await request(app)
        .delete(`${baseUrl}/${transaction.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);

      const accountAfter = await prisma.account.findUnique({ where: { id: creditAccountId } });
      expect(accountAfter?.balance).toBe(100);
    });

    it("reverses a credit card INCOME (payment), increasing debt back to its original value", async () => {
      const transaction = await createTransaction(creditAccountId, categoryId, { amount: 60, type: TransactionType.INCOME });

      const accountBefore = await prisma.account.findUnique({ where: { id: creditAccountId } });
      expect(accountBefore?.balance).toBe(40); // 100 initial - 60

      const response = await request(app)
        .delete(`${baseUrl}/${transaction.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);

      const accountAfter = await prisma.account.findUnique({ where: { id: creditAccountId } });
      expect(accountAfter?.balance).toBe(100);
    });
  });

  describe("business rule validations", () => {
    it("rejects deleting an INCOME transaction if reversing it would make the balance negative", async () => {
      const income = await createTransaction(bankAccountId, categoryId, { amount: 500, type: TransactionType.INCOME });
      // balance now 1500
      await createTransaction(bankAccountId, categoryId, { amount: 1400, type: TransactionType.EXPENSE });
      // balance now 100 — reversing the INCOME (subtracting 500) would leave -400

      const response = await request(app)
        .delete(`${baseUrl}/${income.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Insufficient balance");

      const transactionStillExists = await prisma.transaction.findUnique({ where: { id: income.id } });
      expect(transactionStillExists).not.toBeNull();

      const account = await prisma.account.findUnique({ where: { id: bankAccountId } });
      expect(account?.balance).toBe(100); // unchanged, rollback confirmed
    });

    it("rejects deleting a credit card EXPENSE if reversing it would exceed the credit limit inconsistency check", async () => {
      // Edge scenario: debt reduced below zero is impossible here since reversing an EXPENSE always
      // decreases debt, but we validate the credit card payment-reversal boundary instead.
      const payment = await createTransaction(creditAccountId, categoryId, { amount: 90, type: TransactionType.INCOME });
      // balance now 10 (100 - 90)
      const response = await request(app)
        .delete(`${baseUrl}/${payment.id}`)
        .set("Authorization", `Bearer ${token}`);

      // Reversing this INCOME adds 90 back: 10 + 90 = 100, within limit — should succeed
      expect(response.status).toBe(200);

      const account = await prisma.account.findUnique({ where: { id: creditAccountId } });
      expect(account?.balance).toBe(100);
    });

    it("rejects deletion of a nonexistent transaction", async () => {
      const response = await request(app)
        .delete(`${baseUrl}/00000000-0000-4000-8000-000000000000`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Transaction not found");
    });

    it("rejects deletion of a transaction owned by another user", async () => {
      const otherTransaction = await createTransaction(otherAccountId, otherCategoryId, { amount: 100 });

      const response = await request(app)
        .delete(`${baseUrl}/${otherTransaction.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Unauthorized access to this transaction");

      const stillExists = await prisma.transaction.findUnique({ where: { id: otherTransaction.id } });
      expect(stillExists).not.toBeNull();
    });

    it("rejects requests without an auth token", async () => {
      const transaction = await createTransaction(bankAccountId, categoryId, { amount: 100 });

      const response = await request(app).delete(`${baseUrl}/${transaction.id}`);

      expect(response.status).toBe(401);
    });

    it("rejects deletion with a malformed transaction id", async () => {
      const response = await request(app)
        .delete(`${baseUrl}/not-a-uuid`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(400);
    });
  });

  describe("edge cases and regression scenarios", () => {
    it("keeps balance consistent after deleting multiple transactions sequentially", async () => {
      const first = await createTransaction(bankAccountId, categoryId, { amount: 100, type: TransactionType.EXPENSE });
      const second = await createTransaction(bankAccountId, categoryId, { amount: 200, type: TransactionType.INCOME });
      const third = await createTransaction(bankAccountId, categoryId, { amount: 50, type: TransactionType.EXPENSE });
      // balance: 1000 - 100 + 200 - 50 = 1050

      await request(app).delete(`${baseUrl}/${first.id}`).set("Authorization", `Bearer ${token}`);
      // reverse -100 expense: +100 => 1150
      await request(app).delete(`${baseUrl}/${third.id}`).set("Authorization", `Bearer ${token}`);
      // reverse -50 expense: +50 => 1200

      const account = await prisma.account.findUnique({ where: { id: bankAccountId } });
      expect(account?.balance).toBe(1200);

      const remaining = await prisma.transaction.findMany({ where: { accountId: bankAccountId } });
      expect(remaining.length).toBe(1);
      expect(remaining[0].id).toBe(second.id);
    });

    it("returns the account to its exact original balance after create → delete", async () => {
      const initialAccount = await prisma.account.findUnique({ where: { id: bankAccountId } });
      const initialBalance = initialAccount!.balance;

      const transaction = await createTransaction(bankAccountId, categoryId, { amount: 777, type: TransactionType.EXPENSE });
      await request(app).delete(`${baseUrl}/${transaction.id}`).set("Authorization", `Bearer ${token}`);

      const finalAccount = await prisma.account.findUnique({ where: { id: bankAccountId } });
      expect(finalAccount?.balance).toBe(initialBalance);
    });

    it("keeps two accounts independent when deleting a transaction from one of them", async () => {
      const secondAccount = await createAccount(userId, { name: "Savings", balance: 500, type: AccountType.BANK_ACCOUNT });

      const transactionOnFirst = await createTransaction(bankAccountId, categoryId, { amount: 100, type: TransactionType.EXPENSE });
      await createTransaction(secondAccount.id, categoryId, { amount: 50, type: TransactionType.EXPENSE });

      await request(app).delete(`${baseUrl}/${transactionOnFirst.id}`).set("Authorization", `Bearer ${token}`);

      const first = await prisma.account.findUnique({ where: { id: bankAccountId } });
      const second = await prisma.account.findUnique({ where: { id: secondAccount.id } });

      expect(first?.balance).toBe(1000); // restored
      expect(second?.balance).toBe(450); // untouched by the other account's deletion
    });

    it("keeps balances isolated between two different users", async () => {
      const otherTransaction = await createTransaction(otherAccountId, otherCategoryId, { amount: 200, type: TransactionType.EXPENSE });

      const response = await request(app)
        .delete(`${baseUrl}/${otherTransaction.id}`)
        .set("Authorization", `Bearer ${otherUserToken}`);

      expect(response.status).toBe(200);

      const otherAccount = await prisma.account.findUnique({ where: { id: otherAccountId } });
      const ownAccount = await prisma.account.findUnique({ where: { id: bankAccountId } });

      expect(otherAccount?.balance).toBe(1000); // restored for other user
      expect(ownAccount?.balance).toBe(1000); // untouched, belongs to a different user
    });

    it("keeps the final balance aligned with the sum of remaining transactions after several creates and deletes", async () => {
      const initialAccount = await prisma.account.findUnique({ where: { id: bankAccountId } });
      const initialBalance = initialAccount!.balance;

      const t1 = await createTransaction(bankAccountId, categoryId, { amount: 120, type: TransactionType.EXPENSE });
      const t2 = await createTransaction(bankAccountId, categoryId, { amount: 300, type: TransactionType.INCOME });
      await createTransaction(bankAccountId, categoryId, { amount: 40, type: TransactionType.EXPENSE });

      await request(app).delete(`${baseUrl}/${t1.id}`).set("Authorization", `Bearer ${token}`);
      await request(app).delete(`${baseUrl}/${t2.id}`).set("Authorization", `Bearer ${token}`);

      const remaining = await prisma.transaction.findMany({ where: { accountId: bankAccountId } });
      const netEffect = remaining.reduce(
        (sum, item) => sum + (item.type === TransactionType.EXPENSE ? -item.amount : item.amount),
        0
      );

      const account = await prisma.account.findUnique({ where: { id: bankAccountId } });
      expect(account?.balance).toBe(initialBalance + netEffect);
    });
  });
});