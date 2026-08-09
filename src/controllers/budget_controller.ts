import {Request, Response} from 'express';
import {budgetService} from '../services/budget_service.js';

interface BudgetParams {
    id: string;
}

class BudgetController {
    async create(req: Request, res: Response) {
        try {
            const userId = req.user!.id;

            const budget = await budgetService.create(
                req.body,
                userId
            );

            return res.status(201).json(budget);
        } catch (error) {
            if (error instanceof Error) {
                return res.status(400).json({
                    message: error.message,
                });
            }

            return res.status(500).json({
                message: 'Internal server error',
            });
        }
    }

    async findAll(req: Request, res: Response) {
        try {
            const userId = req.user!.id;

            const budgets = await budgetService.findAllByUserId(userId);

            return res.status(200).json(budgets);
        } catch (error) {
            if (error instanceof Error) {
                return res.status(400).json({
                    message: error.message,
                });
            }

            return res.status(500).json({
                message: 'Internal server error',
            });
        }
    }

    async findById(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            const userId = req.user!.id;

            const budget = await budgetService.findById(
                id,
                userId
            );

            return res.status(200).json(budget);
        } catch (error) {
            if (error instanceof Error) {
                return res.status(400).json({
                    message: error.message,
                });
            }

            return res.status(500).json({
                message: 'Internal server error',
            });
        }
    }

    async update(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            const userId = req.user!.id;

            const budget = await budgetService.update(
                id,
                req.body,
                userId
            );

            return res.status(200).json(budget);
        } catch (error) {
            if (error instanceof Error) {
                return res.status(400).json({
                    message: error.message,
                });
            }

            return res.status(500).json({
                message: 'Internal server error',
            });
        }
    }

    async delete(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            const userId = req.user!.id;

            await budgetService.delete(id, userId);

            return res.status(200).json({
                message: 'Budget deleted successfully',
            });
        } catch (error) {
            if (error instanceof Error) {
                return res.status(400).json({
                    message: error.message,
                });
            }

            return res.status(500).json({
                message: 'Internal server error',
            });
        }
    }
}

export const budgetController = new BudgetController();