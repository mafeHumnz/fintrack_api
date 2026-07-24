import { Request, Response } from "express";
import { transactionService } from "../services/transaction_service.js";

interface TransactionParams {
    id: string;
}

class TransactionController {
    async create(req: Request, res: Response) {
        try {
            const userId = req.user!.id;

            const transaction = await transactionService.create(
                req.body,
                userId
            );

            return res.status(201).json(transaction);
        } catch (error) {
            if (error instanceof Error) {
                return res.status(400).json({
                    message: error.message,
                });
            }

            return res.status(500).json({
                message: "Internal server error",
            });
        }
    }

    async findAll(req: Request, res: Response) {
        try {
            const userId = req.user!.id;

            const transactions = await transactionService.findAll(userId);

            return res.status(200).json(transactions);
        } catch (error) {
            if (error instanceof Error) {
                return res.status(400).json({
                    message: error.message,
                });
            }

            return res.status(500).json({
                message: "Internal server error",
            });
        }
    }

    async findById(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            const userId = req.user!.id;

            const transaction = await transactionService.findById(
                id,
                userId
            );

            return res.status(200).json(transaction);
        } catch (error) {
            if (error instanceof Error) {
                return res.status(400).json({
                    message: error.message,
                });
            }

            return res.status(500).json({
                message: "Internal server error",
            });
        }
    }

    async update(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            const userId = req.user!.id;

            const transaction = await transactionService.update(
                id,
                userId,
                req.body
            );

            return res.status(200).json(transaction);
        } catch (error) {
            if (error instanceof Error) {
                return res.status(400).json({
                    message: error.message,
                });
            }

            return res.status(500).json({
                message: "Internal server error",
            });
        }
    }

    async delete(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            const userId = req.user!.id;

            await transactionService.delete(
                id,
                userId
            );

            return res.status(200).json({ message: "Transaction deleted successfully" });
        } catch (error) {
            if (error instanceof Error) {
                return res.status(400).json({
                    message: error.message,
                });
            }

            return res.status(500).json({
                message: "Internal server error",
            });
        }
    }
}

export const transactionController = new TransactionController();