import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";

class GoalRepository {
    async create(data: Prisma.GoalCreateInput) {
        return prisma.goal.create({
            data,
        });
    }

    async findById(id: string) {
        return prisma.goal.findUnique({
            where: { id },
        });
    }

    async findAllByUserId(userId: string) {
        return prisma.goal.findMany({
            where: { userId },
        });
    }

    async update(
        id: string,
        data: Prisma.GoalUpdateInput
    ) {
        return prisma.goal.update({
            where: { id },
            data,
        });
    }

    async delete(id: string) {
        return prisma.goal.delete({
            where: { id },
        });
    }
}

export const goalRepository = new GoalRepository();

