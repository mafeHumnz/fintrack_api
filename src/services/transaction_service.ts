import {transactionRepository} from '../repositories/transaction_repository.js';
import {accountRepository} from '../repositories/account_repository.js';
import {categoryRepository} from '../repositories/category_repository.js';
import {TransactionType} from '@prisma/client';
import {prisma} from '../config/prisma.js';
import {Account, Transaction} from '@prisma/client';

interface CreateTransactionData {
    amount: number;
    description?: string;
    type: TransactionType;
    date: Date;
    accountId: string;
    categoryId: string;
}

interface UpdateTransactionData {
    amount?: number;
    description?: string;
    type?: TransactionType;
    date?: Date;
    accountId?: string;
    categoryId?: string;
}

class TransactionService {
    async create(data: CreateTransactionData, userId: string) {
    const [account, category] = await Promise.all([
        accountRepository.findById(data.accountId),
        categoryRepository.findById(data.categoryId),
    ]);

    if (!account || account.userId !== userId) {
        throw new Error("Account not found or does not belong to the user");
    }

    if (!category || category.userId !== userId) {
        throw new Error("Category not found or does not belong to the user");
    }

    if (account.type !== "CREDIT_CARD") {
        if (data.type === "EXPENSE" && account.balance < data.amount) {
            throw new Error("Insufficient balance");
        }

        const newBalance = data.type === "EXPENSE"
            ? account.balance - data.amount
            : account.balance + data.amount;

        return prisma.$transaction(async (tx) => {
            await tx.account.update({
                where: { id: account.id },
                data: { balance: newBalance },
            });

            return tx.transaction.create({
                data: {
                    amount: data.amount,
                    description: data.description,
                    type: data.type,
                    date: data.date,
                    account: { connect: { id: data.accountId } },
                    category: { connect: { id: data.categoryId } },
                },
            });
        });
    }

    const newBalance = data.type === "EXPENSE"
        ? account.balance + data.amount
        : account.balance - data.amount;

    if(data.type === "EXPENSE" && newBalance > account.creditLimit!) {
        throw new Error("Credit limit exceeded");
    }

    if(data.type === "INCOME" && newBalance < 0) {
        throw new Error("Payment exceeds current debt");
    }

    return prisma.$transaction(async (tx) => {
        await tx.account.update({
            where: { id: account.id },
            data: { balance: newBalance },
        });

        return tx.transaction.create({
            data: {
                amount: data.amount,
                description: data.description,
                type: data.type,
                date: data.date,
                account: { connect: { id: data.accountId } },
                category: { connect: { id: data.categoryId } },
            },
        });
    });
}
    
    async findAll(userId: string) {
        const transactions = await transactionRepository.findAllByUserId(
            userId
        );

        return transactions;
    }
    
    async findById(
        id: string,
        userId: string
    ) {
        const transaction = await transactionRepository.findById(
            id
        );

        if (!transaction) {
            throw new Error(
                'Transaction not found'
            );
        }

        const account = await accountRepository.findById(
            transaction.accountId
        );

        if (!account || account.userId !== userId) {
            throw new Error(
                'Unauthorized access to this transaction'
            );
        }

        return transaction;
    }
    
    async update(
        id: string,
        userId: string,
        data: UpdateTransactionData
    ) {
        const transaction = await this.findById(
            id,
            userId
        );

        if (data.accountId) {
            const account = await accountRepository.findById(
                data.accountId
            );

            if (!account || account.userId !== userId) {
                throw new Error(
                    'Account not found or does not belong to the user'
                );
            }
        }

        if (data.categoryId) {
            const category = await categoryRepository.findById(
                data.categoryId
            );

            if (!category || category.userId !== userId) {
                throw new Error(
                    'Category not found or does not belong to the user'
                );
            }
        }

        return transactionRepository.update(
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

        return transactionRepository.delete(
            id
        );
    }
    
private reverseAccountBalance(account: Account, transaction: Transaction): number {
    const isCredit = account.type === "CREDIT_CARD";
    if (transaction.type === "EXPENSE") {
        return isCredit ? account.balance - transaction.amount : account.balance + transaction.amount;
    }
    return isCredit ? account.balance + transaction.amount : account.balance - transaction.amount;
}

private applyAccountBalance(account: Account, type: "EXPENSE" | "INCOME", amount: number): number {
    const isCredit = account.type === "CREDIT_CARD";
    if (type === "EXPENSE") {
        return isCredit ? account.balance + amount : account.balance - amount;
    }
    return isCredit ? account.balance - amount : account.balance + amount;
}

private validateBalance(account: Account, newBalance: number) {
    if (account.type === "CREDIT_CARD") {
        if (newBalance > account.creditLimit!) {
            throw new Error("Credit limit exceeded");
        }
        if (newBalance < 0) {
            throw new Error("Payment exceeds current debt");
        }
    } else if (newBalance < 0) {
        throw new Error("Insufficient balance");
    }
}
}

export const transactionService = new TransactionService();