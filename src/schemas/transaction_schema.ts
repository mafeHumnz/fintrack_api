import {z} from "zod";

export const transactionSchema = z.object({
    amount: z.number().min(0.01, "Amount must be greater than 0"),
    description: z.string().max(255, "Description must be at most 255 characters").optional(),
    type: z.enum(["INCOME", "EXPENSE"]),
    date: z.string().refine((date) => !isNaN(Date.parse(date)), {
        message: "Invalid date format",
    }),
    accountId: z.uuid("Invalid account ID"),
    categoryId: z.uuid("Invalid category ID"),
});

export const transactionUpdateSchema = z.object({
    amount: z.number().min(0.01, "Amount must be greater than 0").optional(),
    description: z.string().max(255, "Description must be at most 255 characters").optional(),
    type: z.enum(["INCOME", "EXPENSE"]).optional(),
    date: z.string().refine((date) => !isNaN(Date.parse(date)), {
        message: "Invalid date format",
    }).optional(),
    accountId: z.uuid("Invalid account ID").optional(),
    categoryId: z.uuid("Invalid category ID").optional(),
});