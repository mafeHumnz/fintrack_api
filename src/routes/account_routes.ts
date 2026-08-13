import {Router} from "express";
import { accountController } from "../controllers/account_controller.js";
import { authenticateToken } from "../middlewares/protect_middleware.js";
import { accountSchema, accountUpdateSchema } from "../schemas/account_schema.js";
import { validateSchema } from "../middlewares/auth_middleware.js";

const router = Router();

/**
 * @openapi
 * /accounts:
 *   post:
 *     summary: Create a new account
 *     tags:
 *       - Accounts
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
 *               - balance
 *               - currency
 *               - type
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Main Wallet"
 *               balance:
 *                 type: number
 *                 example: 1000.5
 *               creditLimit:
 *                 type: number
 *                 example: 5000
 *                 description: Required only when `type` is CREDIT_CARD
 *               currency:
 *                 type: string
 *                 example: "USD"
 *               type:
 *                 type: string
 *                 enum: [CASH, BANK_ACCOUNT, CREDIT_CARD]
 *                 example: "BANK_ACCOUNT"
 *     responses:
 *       201:
 *         description: Account created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                   example: "550e8400-e29b-41d4-a716-446655440000"
 *                 name:
 *                   type: string
 *                   example: "Main Wallet"
 *                 balance:
 *                   type: number
 *                   example: 1000.5
 *                 creditLimit:
 *                   type: number
 *                   example: 5000
 *                 currency:
 *                   type: string
 *                   example: "USD"
 *                 type:
 *                   type: string
 *                   example: "BANK_ACCOUNT"
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
 *                   example: "Credit limit is required for credit card accounts"
 *       500:
 *         description: Internal server error
 */
router.post("/", authenticateToken, validateSchema(accountSchema), accountController.create);

/**
 * @openapi
 * /accounts:
 *   get:
 *     summary: Get all accounts for the authenticated user
 *     tags:
 *       - Accounts
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of accounts
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
 *                     example: "550e8400-e29b-41d4-a716-446655440000"
 *                   name:
 *                     type: string
 *                     example: "Main Wallet"
 *                   balance:
 *                     type: number
 *                     example: 1000.5
 *                   currency:
 *                     type: string
 *                     example: "USD"
 *                   type:
 *                     type: string
 *                     example: "CASH"
 *       400:
 *         description: Validation or business error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       500:
 *         description: Internal server error
 */
router.get("/", authenticateToken, accountController.findAll);

/**
 * @openapi
 * /accounts/summary:
 *   get:
 *     summary: Get accounts summary for the authenticated user
 *     tags:
 *       - Accounts
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Summary object (netWorth and accounts with credit info)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 netWorth:
 *                   type: number
 *                   example: 2500.75
 *                 accounts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                         example: "550e8400-e29b-41d4-a716-446655440000"
 *                       name:
 *                         type: string
 *                         example: "Credit Card"
 *                       balance:
 *                         type: number
 *                         example: 500
 *                       creditLimit:
 *                         type: number
 *                         example: 2000
 *                       currency:
 *                         type: string
 *                         example: "USD"
 *                       type:
 *                         type: string
 *                         example: "CREDIT_CARD"
 *                       availableCredit:
 *                         type: number
 *                         example: 1500
 *                       creditUsage:
 *                         type: number
 *                         example: 25
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Missing or invalid auth token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       500:
 *         description: Internal server error
 */
router.get("/summary", authenticateToken, accountController.getSummary);

/**
 * @openapi
 * /accounts/{id}:
 *   get:
 *     summary: Get account by id
 *     tags:
 *       - Accounts
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
 *         description: Account object
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       401:
 *         description: Missing or invalid auth token
 *       404:
 *         description: Account not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       500:
 *         description: Internal server error
 */
router.get("/:id", authenticateToken, accountController.findById);

/**
 * @openapi
 * /accounts/{id}:
 *   patch:
 *     summary: Update account fields
 *     tags:
 *       - Accounts
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
 *                 example: "Updated name"
 *               balance:
 *                 type: number
 *                 example: 2000
 *               creditLimit:
 *                 type: number
 *                 example: 6000
 *               currency:
 *                 type: string
 *                 example: "USD"
 *               type:
 *                 type: string
 *                 enum: [CASH, BANK_ACCOUNT, CREDIT_CARD]
 *     responses:
 *       200:
 *         description: Updated account
 *       400:
 *         description: Validation error
 *       401:
 *         description: Missing or invalid auth token
 *       500:
 *         description: Internal server error
 */
router.patch("/:id", authenticateToken, validateSchema(accountUpdateSchema), accountController.update);

/**
 * @openapi
 * /accounts/{id}:
 *   delete:
 *     summary: Delete an account
 *     tags:
 *       - Accounts
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
 *                   example: "Account deleted successfully"
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
router.delete("/:id", authenticateToken, accountController.delete);

export default router;