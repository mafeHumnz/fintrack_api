import {z} from "zod";
import {CategoryType} from "@prisma/client";

export const categorySchema = z.object({
    name: z.string().min(1, "Name is required"),
    type: z.enum(CategoryType, {
            message: "Type must be one of the following: INCOME, EXPENSE",
        }),
});

export const categoryUpdateSchema = categorySchema.partial().refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one field must be provided for update" }
);