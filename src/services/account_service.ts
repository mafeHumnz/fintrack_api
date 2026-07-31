import { accountRepository } from "../repositories/account_repository.js"; 
import {AccountType} from "@prisma/client";
import {Prisma} from "@prisma/client";

interface CreateAccountData {
    name: string;
    balance: number;
    currency: string;
    type: AccountType;
}

interface UpdateAccountData {
    name?: string;
    balance?: number;
    currency?: string;
    type?: AccountType;
}

class AccountService {
    async create(data: CreateAccountData, userId: string) {
    try {
        return await accountRepository.create({
            ...data,
            user: { connect: { id: userId } },
        });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            throw new Error("Account with this name already exists");
        }
        throw error;
    }
}

    async findAll(userId: string) {
        return accountRepository.findAllByUserId(
            userId
        );
    }

    async findById(
        id: string,
        userId: string
    ) {

        const account =
            await accountRepository.findById(id);

        if (!account) {
            throw new Error(
                "Account not found"
            );
        }

        if (account.userId !== userId) {
            throw new Error(
                "Unauthorized access"
            );
        }

        return account;
    }

    async update(
        id: string,
        userId: string,
        data: UpdateAccountData
    ) {

        await this.findById(
            id,
            userId
        );

        return accountRepository.update(
            id,
            data
        );
    }

    async delete(
        id: string,
        userId: string
    ) {

        await this.findById(
            id,
            userId
        );

        return accountRepository.delete(id);
    }

    async getSummary(userId: string) {
        const accounts = await accountRepository.findAllByUserId(userId);

        const netWorth = accounts.reduce((total, account) => {
            if (account.type === "CREDIT_CARD") {
                return total - account.balance;
            }
            return total + account.balance;
        }, 0);

        const accountsWithCreditInfo = accounts.map((account) => {
            if (account.type !== "CREDIT_CARD") {
                return account;
            }

            return {
                ...account,
                availableCredit: account.creditLimit! - account.balance,
                creditUsage: (account.balance / account.creditLimit!) * 100,
            };
        });

        return { netWorth, accounts: accountsWithCreditInfo };
    }
}

export const accountService =
    new AccountService();