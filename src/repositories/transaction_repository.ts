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

    async findAllByAccountId(accountId: string) {
        return prisma.transaction.findMany({
            where: { accountId },
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
}

export const transactionRepository = new TransactionRepository();