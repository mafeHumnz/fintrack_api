import {z} from "zod";
import {AccountType} from "@prisma/client";

const baseAccountSchema = z.object({
    name: z.string().min(1, "Name is required"),
    balance: z.number().min(0, "Balance must be a non-negative number"),
    creditLimit: z.number().min(0, "Credit limit must be a non-negative number").optional(),
    currency: z.string().length(3, "Currency must be a 3-letter code"),
    type: z.enum(AccountType, { message: "Type must be one of the following: CASH, BANK_ACCOUNT, CREDIT_CARD" }),
});

export const accountSchema = baseAccountSchema.refine(
    (data) => data.type !== "CREDIT_CARD" || data.creditLimit !== undefined,
    { message: "Credit limit is required for credit card accounts", path: ["creditLimit"] }
);

export const accountUpdateSchema = baseAccountSchema.partial().refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one field must be provided for update" }
);