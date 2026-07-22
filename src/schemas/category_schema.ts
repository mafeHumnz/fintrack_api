import {z} from "zod";

export const categorySchema = z.object({
    name: z.string().min(1, "Name is required"),
    type: z.enum(["INCOME", "EXPENSE"]),
});

export const categoryUpdateSchema = z.object({
    name: z.string().min(1, "Name is required").optional(),
    type: z.enum(["INCOME", "EXPENSE"]).optional(),
});