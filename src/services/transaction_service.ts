import {transactionRepository} from '../repositories/transaction_repository.js';
import {accountRepository} from '../repositories/account_repository.js';
import {categoryRepository} from '../repositories/category_repository.js';

interface CreateTransactionData {
    amount: number;
    description?: string;
    type: 'income' | 'expense';
    date: Date;
    accountId: string;
    categoryId: string;
}

interface UpdateTransactionData {
    amount?: number;
    description?: string;
    type?: 'income' | 'expense';
    date?: Date;
    accountId?: string;
    categoryId?: string;
}

class TransactionService {
    async create(
        data: CreateTransactionData,
        userId: string
    ) {
        const account = await accountRepository.findById(
            data.accountId
        );

        if (!account || account.userId !== userId) {
            throw new Error(
                'Account not found or does not belong to the user'
            );
        }

        const category = await categoryRepository.findById(
            data.categoryId
        );

        if (!category || category.userId !== userId) {
            throw new Error(
                'Category not found or does not belong to the user'
            );
        }

        return transactionRepository.create({
            amount: data.amount,
            description: data.description,
            type: data.type,
            date: data.date,
            account: {
                connect: { id: data.accountId },
            },
            category: {
                connect: { id: data.categoryId },
            },
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
}

export const transactionService = new TransactionService();