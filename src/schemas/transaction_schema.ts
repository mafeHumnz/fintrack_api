import {z} from "zod";

export const transactionSchema = z.object({
    amount: z.number().min(0.01, "Amount must be greater than 0"),
    description: z.string().max(255, "Description must be at most 255 characters").min(1, "Description is required"),
    type: z.enum(["INCOME", "EXPENSE"]),
    date: z.coerce.date(),
    accountId: z.uuid("Invalid account ID"),
    categoryId: z.uuid("Invalid category ID"),
});

export const transactionUpdateSchema = transactionSchema.partial().refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one field must be provided for update" }
);

