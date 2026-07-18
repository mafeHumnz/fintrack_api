import { accountRepository } from "../repositories/account_repository.js";

interface CreateAccountData {
    name: string;
    balance: number;
    currency: string;
    type: "CASH" | "BANK_ACCOUNT" | "CREDIT_CARD";
}

interface UpdateAccountData {
    name?: string;
    balance?: number;
    currency?: string;
    type?: "CASH" | "BANK_ACCOUNT" | "CREDIT_CARD";
}

class AccountService {
    async create(
        data: CreateAccountData,
        userId: string
    ) {

        const existingAccount =
            await accountRepository.findAllByUserId(
                userId
            );

        const accountExists =
            existingAccount.some(
                account =>
                    account.name.toLowerCase() ===
                    data.name.toLowerCase()
            );

        if (accountExists) {
            throw new Error(
                "Account with this name already exists"
            );
        }

        return accountRepository.create({
            ...data,
            user: {
                connect: { id: userId },
            },
        });
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
}

export const accountService =
    new AccountService();