import {prisma} from "../config/prisma.js";

class AccountRepository {
    async create(data: {
        name: string;
        balance: number;
        currency: string;
        type: "CASH" | "BANK_ACCOUNT" | "CREDIT_CARD";
        userId: string;
    }) {
        return await prisma.account.create({
            data,
        });
    }

    async findById(id: string) {
        return await prisma.account.findUnique({
            where: {id},
        });
    }

    async findAllByUserId(userId: string) {
        return await prisma.account.findMany({
            where: {userId},
        });
    }

    async update(id: string, data: Partial<{
        name: string;
        balance: number;
        currency: string;
        type: "CASH" | "BANK_ACCOUNT" | "CREDIT_CARD";
    }>) {
        return await prisma.account.update({
            where: {id},
            data,
        });
    }

    async delete(id: string) {
        return await prisma.account.delete({
            where: {id},
        });
    }
}

export const accountRepository = new AccountRepository();


