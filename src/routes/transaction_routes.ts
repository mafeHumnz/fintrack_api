import {Router} from "express";
import { transactionController } from "../controllers/transaction_controller.js";
import { authenticateToken } from "../middlewares/protect_middleware.js";
import { transactionSchema, transactionUpdateSchema } from "../schemas/transaction_schema.js";
import { validateSchema } from "../middlewares/auth_middleware.js";

const router = Router();

/**
 * @openapi
 * /transactions:
 *   post:
 *     summary: Create a new transaction
 *     tags:
 *       - Transactions
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - description
 *               - type
 *               - date
 *               - accountId
 *               - categoryId
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 123.45
 *               description:
 *                 type: string
 *                 example: "Grocery shopping"
 *               type:
 *                 type: string
 *                 enum: [INCOME, EXPENSE]
 *                 example: EXPENSE
 *               date:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-08-12"
 *               accountId:
 *                 type: string
 *                 format: uuid
 *                 example: "550e8400-e29b-41d4-a716-446655440000"
 *               categoryId:
 *                 type: string
 *                 format: uuid
 *                 example: "550e8400-e29b-41d4-a716-446655440001"
 *     responses:
 *       201:
 *         description: Created transaction
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                   example: "550e8400-e29b-41d4-a716-446655440010"
 *                 amount:
 *                   type: number
 *                   example: 123.45
 *                 description:
 *                   type: string
 *                   example: "Grocery shopping"
 *                 type:
 *                   type: string
 *                   example: "EXPENSE"
 *                 date:
 *                   type: string
 *                   format: date-time
 *                 accountId:
 *                   type: string
 *                   format: uuid
 *                 categoryId:
 *                   type: string
 *                   format: uuid
 *                 createdAt:
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
 *       401:
 *         description: Missing or invalid auth token
 *       500:
 *         description: Internal server error
 */
router.post("/", authenticateToken, validateSchema(transactionSchema), transactionController.create);

/**
 * @openapi
 * /transactions:
 *   get:
 *     summary: Get all transactions for the authenticated user
 *     tags:
 *       - Transactions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of transactions
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
 *                   amount:
 *                     type: number
 *                   description:
 *                     type: string
 *                   type:
 *                     type: string
 *                   date:
 *                     type: string
 *                     format: date-time
 *                   accountId:
 *                     type: string
 *                     format: uuid
 *                   categoryId:
 *                     type: string
 *                     format: uuid
 *       400:
 *         description: Validation or business error
 *       401:
 *         description: Missing or invalid auth token
 *       500:
 *         description: Internal server error
 */
router.get("/", authenticateToken, transactionController.findAll);

/**
 * @openapi
 * /transactions/{id}:
 *   get:
 *     summary: Get transaction by id
 *     tags:
 *       - Transactions
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
 *         description: Transaction object
 *       400:
 *         description: Validation or business error
 *       401:
 *         description: Missing or invalid auth token
 *       404:
 *         description: Transaction not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id", authenticateToken, transactionController.findById);

/**
 * @openapi
 * /transactions/{id}:
 *   patch:
 *     summary: Update a transaction (partial)
 *     tags:
 *       - Transactions
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
 *             description: At least one field must be provided
 *             properties:
 *               amount:
 *                 type: number
 *               description:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [INCOME, EXPENSE]
 *               date:
 *                 type: string
 *                 format: date-time
 *               accountId:
 *                 type: string
 *                 format: uuid
 *               categoryId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Updated transaction
 *       400:
 *         description: Validation or business error
 *       401:
 *         description: Missing or invalid auth token
 *       500:
 *         description: Internal server error
 */
router.patch("/:id", authenticateToken, validateSchema(transactionUpdateSchema), transactionController.update);

/**
 * @openapi
 * /transactions/{id}:
 *   delete:
 *     summary: Delete a transaction
 *     tags:
 *       - Transactions
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
 *                   example: "Transaction deleted successfully"
 *       400:
 *         description: Validation or business error
 *       401:
 *         description: Missing or invalid auth token
 *       500:
 *         description: Internal server error
 */
router.delete("/:id", authenticateToken, transactionController.delete);

export default router;