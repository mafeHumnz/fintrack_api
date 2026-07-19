import {categoryRepository} from "../repositories/category_repository.js";

interface CreateCategoryData {
    name: string;
    type: "INCOME" | "EXPENSE";
}

interface UpdateCategoryData {
    name?: string;
    type?: "INCOME" | "EXPENSE";
}

class CategoryService {
    async create(
        data: CreateCategoryData,
        userId: string
    ) {
        const existingCategory =
            await categoryRepository.findAllByUserId(
                userId
            );

        const categoryExists =
            existingCategory.some(
                category =>
                    category.name.toLowerCase() ===
                    data.name.toLowerCase()
            );

        if (categoryExists) {
            throw new Error(
                "Category with this name already exists"
            );
        }

        return categoryRepository.create({
            ...data,
            user: {
                connect: { id: userId },
            },
        });
    }

    async findAll(userId: string) {
        return categoryRepository.findAllByUserId(
            userId
        );
    }

    async findById(
        id: string,
        userId: string
    ) {
        const category =
            await categoryRepository.findById(id);

        if (!category || category.userId !== userId) {
            throw new Error(
                "Category not found or does not belong to the user"
            );
        }

        return category;
    }

    async update(
        id: string,
        data: UpdateCategoryData,
        userId: string
    ) {
        const category =
            await this.findById(id, userId);

        return categoryRepository.update(
            category.id,
            data
        );
    }

    async delete(id: string, userId: string) {
        const category =
            await this.findById(id, userId);

        return categoryRepository.delete(category.id);
    }
}

export const categoryService = new CategoryService();