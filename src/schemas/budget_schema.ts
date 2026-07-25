import {z} from "zod";

export const budgetSchema = z.object({
    name: z.string().min(1, { message: "Budget name is required" }),
    amount: z.number().min(0, { message: "Budget amount must be greater than or equal to 0" }),
    month: z.number().int().min(1).max(12, { message: "Month must be between 1 and 12" }),
    year: z.number().int().min(2000, { message: "Year must be greater than or equal to 2000" }),
    categoryId: z.uuid({ message: "Category ID must be a valid UUID" }),
});

export const budgetUpdateSchema = budgetSchema.partial().refine((data) => Object.keys(data).length > 0, 
{ message: "At least one field must be provided for update" });