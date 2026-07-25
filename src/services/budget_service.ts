import {budgetRepository} from "../repositories/budget_repository.js";
import {transactionRepository} from "../repositories/transaction_repository.js";
import {categoryRepository} from "../repositories/category_repository.js";

interface CreateBudgetData {
    name: string;
    amount: number;
    month: number;
    year: number;
    categoryId: string;
}

interface UpdateBudgetData {
    name?: string;
    amount?: number;
    month?: number;
    year?: number;
    categoryId?: string;
}

class BudgetService {
    async create(
        data: CreateBudgetData,
        userId: string
    ) {
        const category = await categoryRepository.findById(data.categoryId);

        if (!category || category.userId !== userId) {
            throw new Error(
                "Category not found or does not belong to the user"
            );
        }

        return budgetRepository.create({
            name: data.name,
            amount: data.amount,
            month: data.month,
            year: data.year,
            user:{
                connect: { id: userId },
            },
            category: {
                connect: { id: data.categoryId },
            },
        });


    }

    async findAllByUserId(userId: string) {
        const budgets = await budgetRepository.findAllByUserId(userId);
        
        return await Promise.all(budgets.map(async (budget) => {
            const spent = await transactionRepository.getTotalExpensesByCategory(
                userId,
                budget.categoryId,
                budget.month,
                budget.year
            );

            return {
                ...budget,
                spent,
                remaining: budget.amount - spent,
            };
        }));
    }

    async findById(id: string, userId: string) {
        const budget = await budgetRepository.findById(id);

        if (!budget || budget.userId !== userId) {
            throw new Error("Budget not found or does not belong to the user");
        }

        const spent = await transactionRepository.getTotalExpensesByCategory(
            userId,
            budget.categoryId,
            budget.month,
            budget.year
        );

        return {
            ...budget,
            spent,
            remaining: budget.amount - spent,
        };
    }

    async update(
        id: string,
        data: UpdateBudgetData,
        userId: string
    ) {
        const budget = await budgetRepository.findById(id);

        if (!budget || budget.userId !== userId) {
            throw new Error("Budget not found or does not belong to the user");
        }

        if (data.categoryId) {
            const category = await categoryRepository.findById(data.categoryId);

            if (!category || category.userId !== userId) {
                throw new Error(
                    "Category not found or does not belong to the user"
                );
            }
        }

        return budgetRepository.update(id, data);
    }

    async delete(id: string, userId: string) {
        const budget = await budgetRepository.findById(id);

        if (!budget || budget.userId !== userId) {
            throw new Error("Budget not found or does not belong to the user");
        }

        return budgetRepository.delete(id);
    }
}

export const budgetService = new BudgetService();