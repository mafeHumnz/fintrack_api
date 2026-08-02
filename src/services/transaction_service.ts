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

        const newBalance = this.applyAccountBalance(account, data.type, data.amount);
        this.validateBalance(account, newBalance);

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
    
    async update(id: string, userId: string, data: UpdateTransactionData) {
        const transaction = await this.findById(id, userId);

        const [oldAccount, newAccount, category] = await Promise.all([
            accountRepository.findById(transaction.accountId),
            data.accountId ? accountRepository.findById(data.accountId) : Promise.resolve(null),
            data.categoryId ? categoryRepository.findById(data.categoryId) : Promise.resolve(null),
        ]);

        if (!oldAccount) {
            throw new Error("Account not found");
        }

        if (data.accountId && (!newAccount || newAccount.userId !== userId)) {
            throw new Error("Account not found or does not belong to the user");
        }

        if (data.categoryId && (!category || category.userId !== userId)) {
            throw new Error("Category not found or does not belong to the user");
        }

        const newType = data.type ?? transaction.type;
        const newAmount = data.amount ?? transaction.amount;
        const accountChanged = Boolean(data.accountId && data.accountId !== transaction.accountId);
        const targetAccount = accountChanged ? newAccount! : oldAccount;

        let oldAccountFinalBalance: number | null = null;
        let targetAccountFinalBalance: number;

        if (accountChanged) {
            oldAccountFinalBalance = this.reverseAccountBalance(oldAccount, transaction);
            this.validateBalance(oldAccount, oldAccountFinalBalance);

            targetAccountFinalBalance = this.applyAccountBalance(targetAccount, newType, newAmount);
            this.validateBalance(targetAccount, targetAccountFinalBalance);
        } else {
            const reversedBalance = this.reverseAccountBalance(oldAccount, transaction);
            const accountAfterReversal = { ...oldAccount, balance: reversedBalance };

            targetAccountFinalBalance = this.applyAccountBalance(accountAfterReversal, newType, newAmount);
            this.validateBalance(accountAfterReversal, targetAccountFinalBalance);
        }

        return prisma.$transaction(async (tx) => {
            if (accountChanged && oldAccountFinalBalance !== null) {
                await tx.account.update({
                    where: { id: oldAccount.id },
                    data: { balance: oldAccountFinalBalance },
                });
            }

            await tx.account.update({
                where: { id: targetAccount.id },
                data: { balance: targetAccountFinalBalance },
            });

            return tx.transaction.update({
                where: { id },
                data: {
                    amount: data.amount,
                    description: data.description,
                    type: data.type,
                    date: data.date,
                    account: data.accountId ? { connect: { id: data.accountId } } : undefined,
                    category: data.categoryId ? { connect: { id: data.categoryId } } : undefined,
                },
            });
        });
}
    
    async delete(id: string, userId: string) {
        const transaction = await this.findById(id, userId);
        const account = await accountRepository.findById(transaction.accountId);

        if (!account) {
            throw new Error("Account not found");
        }

        const reversedBalance = this.reverseAccountBalance(account, transaction);
        this.validateBalance(account, reversedBalance);

        return prisma.$transaction(async (tx) => {
            await tx.account.update({
                where: { id: account.id },
                data: { balance: reversedBalance },
            });

            return tx.transaction.delete({ where: { id } });
        });
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