import {z} from "zod";

export const goalSchema = z.object({
    name: z.string().min(1, "Name is required"),
    targetAmount: z.number().min(1, "Target amount must be greater than 0"),
    currentAmount: z.number().min(0, "Current amount cannot be negative"),
    targetDate: z.date().refine(date => date > new Date(), {
        message: "Target date must be in the future",
    }),
});

export const updateGoalSchema = goalSchema.partial().refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
});