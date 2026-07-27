import {z} from "zod";

const baseGoalSchema = z.object({
    name: z.string().min(1, "Name is required"),
    targetAmount: z.number().min(1, "Target amount must be greater than 0"),
    currentAmount: z.number().min(0, "Current amount cannot be negative"),
    targetDate: z.date().refine(date => date > new Date(), {
        message: "Target date must be in the future",
    }),
});

export const goalSchema = baseGoalSchema.refine(
    (data) => data.currentAmount <= data.targetAmount,
    { message: "Current amount cannot exceed target amount", path: ["currentAmount"] }
);

export const updateGoalSchema = baseGoalSchema.partial().refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one field must be provided for update" }
);