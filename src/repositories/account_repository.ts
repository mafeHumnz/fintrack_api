import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";

class AccountRepository {
    async create(data: Prisma.AccountCreateInput) {
        return prisma.account.create({
            data,
        });
    }

    async findById(id: string) {
        return prisma.account.findUnique({
            where: { id },
        });
    }

    async findAllByUserId(userId: string) {
        return prisma.account.findMany({
            where: { userId },
        });
    }

    async update(
        id: string,
        data: Prisma.AccountUpdateInput
    ) {
        return prisma.account.update({
            where: { id },
            data,
        });
    }

    async delete(id: string) {
        return prisma.account.delete({
            where: { id },
        });
    }
}

export const accountRepository = new AccountRepository();