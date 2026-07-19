import { Request, Response } from "express";
import { categoryService } from "../services/category_service.js";

interface CategoryParams {
    id: string;
}

class CategoryController {
    async create(req: Request, res: Response) {
        try {
            const userId = req.user!.id;

            const category = await categoryService.create(
                req.body,
                userId
            );

            return res.status(201).json(category);
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

            const categories = await categoryService.findAll(userId);

            return res.status(200).json(categories);
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

            const category = await categoryService.findById(
                id,
                userId
            );

            if (!category) {
                return res.status(404).json({
                    message: "Category not found",
                });
            }

            return res.status(200).json(category);
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

export const categoryController = new CategoryController();