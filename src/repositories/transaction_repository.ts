import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";

class TransactionRepository {
    async create(data: Prisma.TransactionCreateInput) {
        return prisma.transaction.create({
            data,
        });
    }

    async findById(id: string) {
        return prisma.transaction.findUnique({
            where: { id },
        });
    }

    async findAllByUserId(userId: string) {
        return prisma.transaction.findMany({
            where: {
                account: {
                    userId,
                },
            },
            orderBy: {
                date: 'desc',
            },
        });
    }

    async update(
        id: string,
        data: Prisma.TransactionUpdateInput
    ) {
        return prisma.transaction.update({
            where: { id },
            data,
        });
    }

    async delete(id: string) {
        return prisma.transaction.delete({
            where: { id },
        });
    }

    async getTotalExpensesByCategory(userId: string, categoryId: string, month: number, year: number) {
        const result = await prisma.transaction.aggregate({
            where: {
                account: {
                    userId,
                },
                type: 'Expense',
                categoryId,
                date: {
                    gte: new Date(year, month - 1, 1),
                    lt: new Date(year, month, 1),
                },
            },
            _sum: {
                amount: true,
            },
        });

        return result._sum.amount ?? 0;
    }
}

export const transactionRepository = new TransactionRepository();