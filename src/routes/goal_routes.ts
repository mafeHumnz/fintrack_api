import {Router} from "express";
import { goalController } from "../controllers/goal_controller.js";
import { authenticateToken } from "../middlewares/protect_middleware.js";
import { goalSchema, updateGoalSchema } from "../schemas/goal_schema.js";
import { validateSchema } from "../middlewares/auth_middleware.js";

const router = Router();

/**
 * @openapi
 * /goals:
 *   post:
 *     summary: Create a savings goal
 *     tags:
 *       - Goals
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - targetAmount
 *               - currentAmount
 *               - targetDate
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Vacation fund"
 *               targetAmount:
 *                 type: number
 *                 example: 2000
 *               currentAmount:
 *                 type: number
 *                 example: 150
 *               targetDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-12-31"
 *     responses:
 *       201:
 *         description: Created goal (DB model)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 name:
 *                   type: string
 *                 targetAmount:
 *                   type: number
 *                 currentAmount:
 *                   type: number
 *                 targetDate:
 *                   type: string
 *                   format: date-time
 *                 userId:
 *                   type: string
 *                   format: uuid
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Validation or business error (controller returns `error.message`)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Current amount cannot exceed target amount"
 *       401:
 *         description: Missing or invalid auth token
 *       500:
 *         description: Internal server error
 */
router.post("/", authenticateToken, validateSchema(goalSchema), goalController.create);

/**
 * @openapi
 * /goals:
 *   get:
 *     summary: List goals (includes progress summary)
 *     tags:
 *       - Goals
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of goal summaries
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     format: uuid
 *                   name:
 *                     type: string
 *                   targetAmount:
 *                     type: number
 *                   currentAmount:
 *                     type: number
 *                   targetDate:
 *                     type: string
 *                     format: date-time
 *                   progress:
 *                     type: integer
 *                     example: 10
 *                   remaining:
 *                     type: number
 *                     example: 1850
 *                   completed:
 *                     type: boolean
 *                   daysRemaining:
 *                     type: integer
 *                     example: 120
 *       400:
 *         description: Validation or business error (controller returns `error.message`)
 *       401:
 *         description: Missing or invalid auth token
 *       500:
 *         description: Internal server error
 */
router.get("/", authenticateToken, goalController.findAll);

/**
 * @openapi
 * /goals/{id}:
 *   get:
 *     summary: Get goal summary by id
 *     tags:
 *       - Goals
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Goal summary (includes progress, remaining, daysRemaining)
 *       400:
 *         description: Validation or business error (controller returns `error.message`)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Goal not found or does not belong to the user"
 *       401:
 *         description: Missing or invalid auth token
 *       500:
 *         description: Internal server error
 */
router.get("/:id", authenticateToken, goalController.findById);

/**
 * @openapi
 * /goals/{id}:
 *   patch:
 *     summary: Update a goal (partial)
 *     tags:
 *       - Goals
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: At least one field must be provided for update
 *             properties:
 *               name:
 *                 type: string
 *               targetAmount:
 *                 type: number
 *               currentAmount:
 *                 type: number
 *               targetDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Updated goal (DB model)
 *       400:
 *         description: Validation or business error (controller returns `error.message`)
 *       401:
 *         description: Missing or invalid auth token
 *       500:
 *         description: Internal server error
 */
router.patch("/:id", authenticateToken, validateSchema(updateGoalSchema), goalController.update);

/**
 * @openapi
 * /goals/{id}:
 *   delete:
 *     summary: Delete a goal
 *     tags:
 *       - Goals
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Deletion confirmation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Goal deleted successfully"
 *       400:
 *         description: Validation or business error (controller returns `error.message`)
 *       401:
 *         description: Missing or invalid auth token
 *       500:
 *         description: Internal server error
 */
router.delete("/:id", authenticateToken, goalController.delete);

export default router;