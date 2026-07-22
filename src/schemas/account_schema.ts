import {z} from "zod";

export const accountSchema = z.object({
    name: z.string().min(1, "Name is required"),
    balance: z.number().min(0, "Balance must be a non-negative number"),
    currency: z.string().length(3, "Currency must be a 3-letter code"),
    type: z.enum(["CASH", "BANK_ACCOUNT", "CREDIT_CARD"]),
});

export const accountUpdateSchema = z.object({
    name: z.string().min(1, "Name is required").optional(),
    balance: z.number().min(0, "Balance must be a non-negative number").optional(),
    currency: z.string().length(3, "Currency must be a 3-letter code").optional(),
    type: z.enum(["CASH", "BANK_ACCOUNT", "CREDIT_CARD"]).optional(),
});