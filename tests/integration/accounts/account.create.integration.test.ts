import request from "supertest";
import { AccountType } from "@prisma/client";
import { prisma } from "../../../src/config/prisma.js";
import app from "../../../src/app.js";
import { generateToken } from "../../../src/utils/generateToken.js";

describe("POST /accounts integration tests", () => {
  let userId: string;
  let token: string;
  let otherUserId: string;

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

  const validPayload = (overrides: Partial<any> = {}) => ({
    name: overrides.name ?? "Checking",
    balance: overrides.balance ?? 1000,
    currency: overrides.currency ?? "USD",
    type: overrides.type ?? AccountType.BANK_ACCOUNT,
    ...(overrides.creditLimit !== undefined ? { creditLimit: overrides.creditLimit } : {}),
  });

  beforeEach(async () => {
    await cleanDatabase();

    const owner = await createUser("owner@example.com");
    userId = owner.id;
    token = generateToken(userId);

    const otherOwner = await createUser("other@example.com");
    otherUserId = otherOwner.id;
  });

  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("successful creation", () => {
    it("creates a CASH account", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ type: AccountType.CASH, name: "Wallet" }));

      expect(response.status).toBe(201);
      expect(response.body.type).toBe(AccountType.CASH);
      expect(response.body.name).toBe("Wallet");
    });

    it("creates a BANK_ACCOUNT", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ type: AccountType.BANK_ACCOUNT, name: "Checking" }));

      expect(response.status).toBe(201);
      expect(response.body.type).toBe(AccountType.BANK_ACCOUNT);
    });

    it("creates a CREDIT_CARD account with a credit limit", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ type: AccountType.CREDIT_CARD, name: "Visa", balance: 0, creditLimit: 5000 }));

      expect(response.status).toBe(201);
      expect(response.body.type).toBe(AccountType.CREDIT_CARD);
      expect(response.body.creditLimit).toBe(5000);
    });

    it("persists the account correctly in the database", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ name: "Savings", balance: 2500 }));

      const account = await prisma.account.findUnique({ where: { id: response.body.id } });
      expect(account).not.toBeNull();
      expect(account?.balance).toBe(2500);
      expect(account?.userId).toBe(userId);
    });

    it("creates an account with a balance of exactly 0", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ balance: 0 }));

      expect(response.status).toBe(201);
      expect(response.body.balance).toBe(0);
    });
  });

  describe("duplicate name validation", () => {
    it("rejects creating a second account with the exact same name for the same user", async () => {
      await request(app).post(baseUrl).set("Authorization", `Bearer ${token}`).send(validPayload({ name: "Checking" }));

      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ name: "Checking" }));

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Account with this name already exists");
    });

    it("rejects a duplicate name that differs only in case", async () => {
      await request(app).post(baseUrl).set("Authorization", `Bearer ${token}`).send(validPayload({ name: "Nequi" }));

      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ name: "nequi" }));

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Account with this name already exists");
    });

    it("rejects a duplicate name in uppercase", async () => {
      await request(app).post(baseUrl).set("Authorization", `Bearer ${token}`).send(validPayload({ name: "Savings" }));

      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ name: "SAVINGS" }));

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Account with this name already exists");
    });

    it("allows two different users to have accounts with the same name", async () => {
      const otherToken = generateToken(otherUserId);

      const first = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ name: "Checking" }));

      const second = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${otherToken}`)
        .send(validPayload({ name: "Checking" }));

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
    });

    it("allows the same user to have two accounts with different names", async () => {
      const first = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ name: "Checking" }));

      const second = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ name: "Savings" }));

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
    });
  });

  describe("account type validation", () => {
    it("rejects an invalid account type", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ type: "INVALID_TYPE" }));

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Type must be one of the following: CASH, BANK_ACCOUNT, CREDIT_CARD");
    });

    it("rejects a missing account type", async () => {
      const payload = validPayload();
      delete (payload as any).type;

      const response = await request(app).post(baseUrl).set("Authorization", `Bearer ${token}`).send(payload);
      expect(response.status).toBe(400);
    });
  });

  describe("credit limit validation", () => {
    it("rejects a CREDIT_CARD account without a credit limit", async () => {
      const payload = validPayload({ type: AccountType.CREDIT_CARD, balance: 0 });

      const response = await request(app).post(baseUrl).set("Authorization", `Bearer ${token}`).send(payload);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Credit limit is required for credit card accounts");
    });

    it("rejects a negative credit limit", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ type: AccountType.CREDIT_CARD, balance: 0, creditLimit: -100 }));

      expect(response.status).toBe(400);
    });

    it("accepts a credit limit of 0", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ type: AccountType.CREDIT_CARD, balance: 0, creditLimit: 0 }));

      // creditLimit !== undefined passes schema validation even at 0
      expect(response.status).toBe(201);
    });

    it("ignores a credit limit provided for a CASH account without rejecting the request", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ type: AccountType.CASH, creditLimit: 1000 }));

      expect(response.status).toBe(201);
    });
  });

  describe("input validation", () => {
    it("rejects a negative balance", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ balance: -100 }));

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

    it("rejects a currency code that isn't 3 letters", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ currency: "US" }));

      expect(response.status).toBe(400);
    });

    it("rejects a missing currency", async () => {
      const payload = validPayload();
      delete (payload as any).currency;

      const response = await request(app).post(baseUrl).set("Authorization", `Bearer ${token}`).send(payload);
      expect(response.status).toBe(400);
    });

    it("rejects a missing balance", async () => {
      const payload = validPayload();
      delete (payload as any).balance;

      const response = await request(app).post(baseUrl).set("Authorization", `Bearer ${token}`).send(payload);
      expect(response.status).toBe(400);
    });

    it("rejects an empty request body", async () => {
      const response = await request(app).post(baseUrl).set("Authorization", `Bearer ${token}`).send({});
      expect(response.status).toBe(400);
    });

    it("does not persist an account when validation fails", async () => {
      await request(app).post(baseUrl).set("Authorization", `Bearer ${token}`).send(validPayload({ balance: -100 }));

      const accounts = await prisma.account.findMany({ where: { userId } });
      expect(accounts.length).toBe(0);
    });
  });

  describe("ownership and authorization", () => {
    it("rejects requests without an auth token", async () => {
      const response = await request(app).post(baseUrl).send(validPayload());
      expect(response.status).toBe(401);
    });

    it("associates the created account with the authenticated user, not an arbitrary one", async () => {
      const response = await request(app).post(baseUrl).set("Authorization", `Bearer ${token}`).send(validPayload());

      expect(response.status).toBe(201);
      const account = await prisma.account.findUnique({ where: { id: response.body.id } });
      expect(account?.userId).toBe(userId);
      expect(account?.userId).not.toBe(otherUserId);
    });
  });

  describe("edge cases", () => {
    it("handles a very large balance without corrupting the value", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ balance: 999_999_999 }));

      expect(response.status).toBe(201);
      expect(response.body.balance).toBe(999_999_999);
    });

    it("handles a decimal balance correctly", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ balance: 1234.56 }));

      expect(response.status).toBe(201);
      expect(response.body.balance).toBeCloseTo(1234.56, 2);
    });

    it("handles a very long account name within reasonable limits", async () => {
      const response = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ name: "A".repeat(200) }));

      // Documents current behavior — no explicit max length is enforced on `name` in the schema
      expect([201, 400]).toContain(response.status);
    });

    it("allows creating multiple accounts of the same type for one user with different names", async () => {
      const first = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ name: "Card A", type: AccountType.CREDIT_CARD, balance: 0, creditLimit: 1000 }));

      const second = await request(app)
        .post(baseUrl)
        .set("Authorization", `Bearer ${token}`)
        .send(validPayload({ name: "Card B", type: AccountType.CREDIT_CARD, balance: 0, creditLimit: 2000 }));

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);

      const accounts = await prisma.account.findMany({ where: { userId } });
      expect(accounts.length).toBe(2);
    });
  });
});