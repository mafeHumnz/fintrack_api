import {goalRepository} from "../repositories/goal_repository.js";
import type { Goal } from "@prisma/client";

interface CreateGoalData {
    name: string;
    targetAmount: number;
    currentAmount: number;
    targetDate: Date;
}

interface UpdateGoalData {
    name?: string;
    targetAmount?: number;
    currentAmount?: number;
    targetDate?: Date;
}

class GoalService {
    async create(
        data: CreateGoalData,
        userId: string
    ) {
        return goalRepository.create({
            ...data,
            user: {
                connect: { id: userId },
            },
        });
    }
    
    async findAll(userId: string) {
        const goals = await goalRepository.findAllByUserId(userId);
        return goals.map((goal) => this.buildGoalSummary(goal));
    }

    async findById(id: string, userId: string) {
        const goal = await goalRepository.findById(id);
        if (!goal || goal.userId !== userId) {
            throw new Error("Goal not found or does not belong to the user");
        }
        return this.buildGoalSummary(goal);
    }

    async update(id: string, userId: string, data: UpdateGoalData) {
        const goal = await goalRepository.findById(id);

        if (!goal || goal.userId !== userId) {
            throw new Error("Goal not found or does not belong to the user");
        }
        const resultingCurrentAmount = data.currentAmount ?? goal.currentAmount;
        const resultingTargetAmount = data.targetAmount ?? goal.targetAmount;

        if (resultingCurrentAmount > resultingTargetAmount) {
            throw new Error("Current amount cannot exceed target amount");
        }

        return goalRepository.update(id, data);
    }

    async delete(id: string, userId: string) {
        const goal = await goalRepository.findById(id);

        if (!goal || goal.userId !== userId) {
            throw new Error("Goal not found or does not belong to the user");
        }

        return goalRepository.delete(id);
    }

    private buildGoalSummary(goal: Goal) {
    const progress = goal.targetAmount > 0
        ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
        : 0;
    const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
    const completed = goal.currentAmount >= goal.targetAmount;
    const daysRemaining = Math.max(
        0,
        Math.ceil(
            (goal.targetDate.getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
    );
    return {
        id: goal.id,
        name: goal.name,
        targetAmount: goal.targetAmount,
        currentAmount: goal.currentAmount,
        targetDate: goal.targetDate,
        progress,
        remaining,
        completed,
        daysRemaining,
    };
}
    
}

export const goalService = new GoalService();