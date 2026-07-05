import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";

class AccountRepository {
    async create(data: Prisma.AccountCreateInput) {
        return prisma.account.create({
            data,
        });
    }

    async findById(id: number) {
        return prisma.account.findUnique({
            where: { id },
        });
    }

    async findAllByUserId(userId: number) {
        return prisma.account.findMany({
            where: { userId },
        });
    }

    async update(
        id: number,
        data: Prisma.AccountUpdateInput
    ) {
        return prisma.account.update({
            where: { id },
            data,
        });
    }

    async delete(id: number) {
        return prisma.account.delete({
            where: { id },
        });
    }
}

export const accountRepository = new AccountRepository();