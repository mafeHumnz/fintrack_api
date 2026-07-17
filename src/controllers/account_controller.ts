import { Request, Response } from "express";
import { accountService } from "../services/account_service.js";

interface AccountParams {
    id: string;
}

class AccountController {
    async create(req: Request, res: Response) {
        try {
            const userId = req.user!.id;

            const account = await accountService.create(
                req.body,
                userId
            );

            return res.status(201).json(account);
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

            const accounts = await accountService.findAll(userId);

            return res.status(200).json(accounts);
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

            const account = await accountService.findById(
                id,
                userId
            );

            return res.status(200).json(account);
        } catch (error) {
            if (error instanceof Error) {
                return res.status(404).json({
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

            const account = await accountService.update(
                id,
                userId,
                req.body
            );

            return res.status(200).json(account);
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

            await accountService.delete(
                id,
                userId
            );

            return res.status(204).send();
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

export const accountController = new AccountController();