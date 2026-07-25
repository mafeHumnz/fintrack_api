import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";

class BudgetRepository {
    async create(data: Prisma.BudgetCreateInput) {
        return prisma.budget.create({
            data,
        });
    }

    async findById(id: string) {
        return prisma.budget.findUnique({
            where: { id },
        });
    }

    async findAllByUserId(userId: string) {
        return prisma.budget.findMany({
            where: {
                userId,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async update(
        id: string,
        data: Prisma.BudgetUpdateInput
    ) {
        return prisma.budget.update({
            where: { id },
            data,
        });
    }

    async delete(id: string) {
        return prisma.budget.delete({
            where: { id },
        });
    }
}

export const budgetRepository = new BudgetRepository();