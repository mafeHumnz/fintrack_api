import {z} from "zod";

export const accountSchema = z.object({
    name: z.string().min(1, "Name is required"),
    balance: z.number().min(0, "Balance must be a non-negative number"),
    currency: z.string().length(3, "Currency must be a 3-letter code"),
    type: z.enum(["CASH", "BANK_ACCOUNT", "CREDIT_CARD"]),
});

export const accountUpdateSchema = accountSchema.partial().refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one field must be provided for update" }
);