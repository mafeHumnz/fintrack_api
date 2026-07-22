import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";

class CategoryRepository {
    async create(data: Prisma.CategoryCreateInput) {
        return prisma.category.create({
            data,
        });
    }
    
    async findById(id: string) { 
        return prisma.category.findUnique({
            where: {
                id,
            },
        });
    } 

    async findAllByUserId(userId: string) {
        return prisma.category.findMany({
            where: {
                userId,
            },
        });
    }

    async update(
        id: string,
        data: Prisma.CategoryUpdateInput
    ) {
        return prisma.category.update({
            where: {
                id,
            },
            data,
        });
    }

    async delete(id: string) {
        return prisma.category.delete({
            where: {
                id,
            },
        });
    }
}

export const categoryRepository = new CategoryRepository();