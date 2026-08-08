import request from "supertest";
import { AccountType } from "@prisma/client";
import { prisma } from "../../../src/config/prisma.js";
import app from "../../../src/app.js";
import { generateToken } from "../../../src/utils/generateToken.js";

describe("PATCH /accounts/:id integration tests", () => {
  let userId: string;
  let token: string;
  let otherUserId: string;
  let otherToken: string;
  let bankAccountId: string;
  let creditAccountId: string;
  let otherAccountId: string;

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

    otherAccountId = (await createAccount(otherUserId, { name: "Other account", balance: 1000 })).id;
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
        .patch(`${baseUrl}/${bankAccountId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Renamed Checking" });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe("Renamed Checking");
    });

    it("updates only the balance", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${bankAccountId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ balance: 2500 });

      expect(response.status).toBe(200);
      expect(response.body.balance).toBe(2500);
    });

    it("updates only the currency", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${bankAccountId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ currency: "COP" });

      expect(response.status).toBe(200);
      expect(response.body.currency).toBe("COP");
    });

    it("updates multiple fields at once", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${bankAccountId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "New name", balance: 500, currency: "EUR" });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe("New name");
      expect(response.body.balance).toBe(500);
      expect(response.body.currency).toBe("EUR");
    });

    it("persists changes correctly in the database", async () => {
      await request(app).patch(`${baseUrl}/${bankAccountId}`).set("Authorization", `Bearer ${token}`).send({ balance: 777 });

      const account = await prisma.account.findUnique({ where: { id: bankAccountId } });
      expect(account?.balance).toBe(777);
    });

    it("updates creditLimit alone on an existing CREDIT_CARD account", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${creditAccountId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ creditLimit: 8000 });

      expect(response.status).toBe(200);
      expect(response.body.creditLimit).toBe(8000);
    });
  });

  describe("account type change validation", () => {
    it("rejects changing type to CREDIT_CARD without providing a credit limit", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${bankAccountId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ type: AccountType.CREDIT_CARD });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Credit limit is required for credit card accounts");

      const account = await prisma.account.findUnique({ where: { id: bankAccountId } });
      expect(account?.type).toBe(AccountType.BANK_ACCOUNT); // unchanged
    });

    it("allows changing type to CREDIT_CARD when creditLimit is provided in the same request", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${bankAccountId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ type: AccountType.CREDIT_CARD, creditLimit: 3000 });

      expect(response.status).toBe(200);
      expect(response.body.type).toBe(AccountType.CREDIT_CARD);
      expect(response.body.creditLimit).toBe(3000);
    });

    it("allows changing type from CREDIT_CARD to CASH", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${creditAccountId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ type: AccountType.CASH });

      expect(response.status).toBe(200);
      expect(response.body.type).toBe(AccountType.CASH);
    });

    it("rejects an invalid account type", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${bankAccountId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ type: "INVALID_TYPE" });

      expect(response.status).toBe(400);
    });
  });

  describe("credit limit validation", () => {
    it("rejects a negative credit limit", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${creditAccountId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ creditLimit: -500 });

      expect(response.status).toBe(400);
    });

    it("keeps the existing creditLimit valid when updating unrelated fields on a CREDIT_CARD account", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${creditAccountId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Renamed Visa" });

      expect(response.status).toBe(200);

      const account = await prisma.account.findUnique({ where: { id: creditAccountId } });
      expect(account?.creditLimit).toBe(5000); // unchanged
    });
  });

  describe("duplicate name validation", () => {
    it("rejects renaming an account to a name already used by another account of the same user", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${bankAccountId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Visa" }); // already used by creditAccountId for the same user

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Account with this name already exists");
    });

    it("rejects renaming with a name that differs only in case from an existing account", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${bankAccountId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "visa" });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Account with this name already exists");
    });

    it("allows renaming an account to a name used by another user's account", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${bankAccountId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Other account" }); // belongs to otherUserId

      expect(response.status).toBe(200);
    });

    it("allows renaming an account to its own current name (no-op rename)", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${bankAccountId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Checking", balance: 1500 });

      expect(response.status).toBe(200);
    });
  });

  describe("invalid updates", () => {
    it("rejects an empty update body", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${bankAccountId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("At least one field must be provided for update");
    });

    it("rejects an empty name", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${bankAccountId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "" });

      expect(response.status).toBe(400);
    });

    it("rejects a negative balance", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${bankAccountId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ balance: -100 });

      expect(response.status).toBe(400);
    });

    it("rejects a currency code that isn't 3 letters", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${bankAccountId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ currency: "US" });

      expect(response.status).toBe(400);
    });

    it("rejects updating a nonexistent account", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/00000000-0000-4000-8000-000000000000`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Ghost" });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Account not found");
    });

    it("rejects a malformed account id", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/not-a-uuid`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Anything" });

      expect(response.status).toBe(400);
    });
  });

  describe("ownership and authorization", () => {
    it("rejects updating an account belonging to another user", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${otherAccountId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Hijacked" });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Unauthorized access");

      const account = await prisma.account.findUnique({ where: { id: otherAccountId } });
      expect(account?.name).toBe("Other account"); // unchanged
    });

    it("rejects requests without an auth token", async () => {
      const response = await request(app).patch(`${baseUrl}/${bankAccountId}`).send({ name: "No auth" });
      expect(response.status).toBe(401);
    });
  });

  describe("edge cases and regression scenarios", () => {
    it("handles updating to a very large balance without corrupting the value", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${bankAccountId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ balance: 999_999_999 });

      expect(response.status).toBe(200);
      expect(response.body.balance).toBe(999_999_999);
    });

    it("handles a decimal balance update correctly", async () => {
      const response = await request(app)
        .patch(`${baseUrl}/${bankAccountId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ balance: 1234.56 });

      expect(response.status).toBe(200);
      expect(response.body.balance).toBeCloseTo(1234.56, 2);
    });

    it("supports repeated updates on the same account without drift", async () => {
      await request(app).patch(`${baseUrl}/${bankAccountId}`).set("Authorization", `Bearer ${token}`).send({ balance: 500 });
      await request(app).patch(`${baseUrl}/${bankAccountId}`).set("Authorization", `Bearer ${token}`).send({ balance: 750 });

      const account = await prisma.account.findUnique({ where: { id: bankAccountId } });
      expect(account?.balance).toBe(750);
    });

    it("keeps two accounts independent when updating one of them", async () => {
      await request(app).patch(`${baseUrl}/${bankAccountId}`).set("Authorization", `Bearer ${token}`).send({ balance: 100 });

      const untouched = await prisma.account.findUnique({ where: { id: creditAccountId } });
      expect(untouched?.balance).toBe(200); // unchanged
    });

    it("keeps balances isolated between two different users when updating", async () => {
      await request(app)
        .patch(`${baseUrl}/${otherAccountId}`)
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ balance: 9999 });

      const own = await prisma.account.findUnique({ where: { id: bankAccountId } });
      expect(own?.balance).toBe(1000); // unaffected by another user's update
    });
  });
});