import {Router} from "express";
import { budgetController } from "../controllers/budget_controller.js";
import { authenticateToken } from "../middlewares/protect_middleware.js";
import { budgetSchema, budgetUpdateSchema } from "../schemas/budget_schema.js";
import { validateSchema } from "../middlewares/auth_middleware.js";


const router = Router();

/**
 * @openapi
 * /budgets:
 *   post:
 *     summary: Create a budget
 *     tags:
 *       - Budgets
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
 *               - amount
 *               - month
 *               - year
 *               - categoryId
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Monthly groceries"
 *               amount:
 *                 type: number
 *                 example: 300
 *               month:
 *                 type: integer
 *                 example: 8
 *               year:
 *                 type: integer
 *                 example: 2026
 *               categoryId:
 *                 type: string
 *                 format: uuid
 *                 example: "550e8400-e29b-41d4-a716-446655440002"
 *     responses:
 *       201:
 *         description: Created budget
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
 *                 amount:
 *                   type: number
 *                 month:
 *                   type: integer
 *                 year:
 *                   type: integer
 *                 categoryId:
 *                   type: string
 *                   format: uuid
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
 *         description: Validation or business error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "A budget already exists for this category and period"
 *       401:
 *         description: Missing or invalid auth token
 *       500:
 *         description: Internal server error
 */
router.post("/", authenticateToken, validateSchema(budgetSchema), budgetController.create);

/**
 * @openapi
 * /budgets:
 *   get:
 *     summary: List budgets for the authenticated user
 *     tags:
 *       - Budgets
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of budgets with spent and remaining
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
 *                   amount:
 *                     type: number
 *                   month:
 *                     type: integer
 *                   year:
 *                     type: integer
 *                   categoryId:
 *                     type: string
 *                     format: uuid
 *                   spent:
 *                     type: number
 *                     example: 120
 *                   remaining:
 *                     type: number
 *                     example: 180
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *       400:
 *         description: Validation or business error
 *       401:
 *         description: Missing or invalid auth token
 *       500:
 *         description: Internal server error
 */
router.get("/", authenticateToken, budgetController.findAll);

/**
 * @openapi
 * /budgets/{id}:
 *   get:
 *     summary: Get budget by id
 *     tags:
 *       - Budgets
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
 *         description: Budget with spent and remaining
 *       400:
 *         description: Validation or business error (e.g., not found)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: Missing or invalid auth token
 *       500:
 *         description: Internal server error
 */
router.get("/:id", authenticateToken, budgetController.findById);

/**
 * @openapi
 * /budgets/{id}:
 *   patch:
 *     summary: Update budget fields (partial)
 *     tags:
 *       - Budgets
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
 *               amount:
 *                 type: number
 *               month:
 *                 type: integer
 *               year:
 *                 type: integer
 *               categoryId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Updated budget
 *       400:
 *         description: Validation or business error (e.g., duplicate for period)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: Missing or invalid auth token
 *       500:
 *         description: Internal server error
 */
router.patch("/:id", authenticateToken, validateSchema(budgetUpdateSchema), budgetController.update);

/**
 * @openapi
 * /budgets/{id}:
 *   delete:
 *     summary: Delete a budget
 *     tags:
 *       - Budgets
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
 *                   example: 'Budget deleted successfully'
 *       400:
 *         description: Validation or business error
 *       401:
 *         description: Missing or invalid auth token
 *       500:
 *         description: Internal server error
 */
router.delete("/:id", authenticateToken, budgetController.delete);

export default router;