import type { Request, Response } from "express";
import {goalService} from "../services/goal_service.js";

interface GoalParams {
    id: string;
}

class GoalController {
    async create(req: Request, res: Response) {
        try {
            const userId = req.user!.id;

            const goal = await goalService.create(
                req.body,
                userId
            );

            return res.status(201).json(goal);
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

            const goals = await goalService.findAll(userId);

            return res.status(200).json(goals);
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

            const goal = await goalService.findById(id);

            return res.status(200).json(goal);
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

            const updatedGoal = await goalService.update(
                id,
                req.body
            );

            return res.status(200).json(updatedGoal);
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

            await goalService.delete(id);

            return res.status(200).json({
                message: "Goal deleted successfully",
            });
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

export const goalController = new GoalController();