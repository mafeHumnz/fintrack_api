import {Router} from "express";
import { categoryController } from "../controllers/category_controller.js";
import { authenticateToken } from "../middlewares/protect_middleware.js";
import { categorySchema, categoryUpdateSchema } from "../schemas/category_schema.js";
import { validateSchema } from "../middlewares/auth_middleware.js";

const router = Router();

/**
 * @openapi
 * /categories:
 *   post:
 *     summary: Create a category
 *     tags:
 *       - Categories
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
 *               - type
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Groceries"
 *               type:
 *                 type: string
 *                 enum: [INCOME, EXPENSE]
 *                 example: EXPENSE
 *     responses:
 *       201:
 *         description: Created category
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
 *                 type:
 *                   type: string
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
 *         description: Validation or business error (controller returns error.message)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Category with this name already exists"
 *       401:
 *         description: Missing or invalid auth token
 *       500:
 *         description: Internal server error
 */
router.post("/", authenticateToken, validateSchema(categorySchema), categoryController.create);

/**
 * @openapi
 * /categories:
 *   get:
 *     summary: List categories for the authenticated user
 *     tags:
 *       - Categories
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of categories
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
 *                   type:
 *                     type: string
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *       400:
 *         description: Validation or business error (controller returns error.message)
 *       401:
 *         description: Missing or invalid auth token
 *       500:
 *         description: Internal server error
 */
router.get("/", authenticateToken, categoryController.findAll);

/**
 * @openapi
 * /categories/{id}:
 *   get:
 *     summary: Get category by id
 *     tags:
 *       - Categories
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
 *         description: Category object
 *       400:
 *         description: Validation or business error (controller returns error.message)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Category not found or does not belong to the user"
 *       401:
 *         description: Missing or invalid auth token
 *       404:
 *         description: Category not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Category not found"
 *       500:
 *         description: Internal server error
 */
router.get("/:id", authenticateToken, categoryController.findById);

/**
 * @openapi
 * /categories/{id}:
 *   patch:
 *     summary: Update category (partial)
 *     tags:
 *       - Categories
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
 *               type:
 *                 type: string
 *                 enum: [INCOME, EXPENSE]
 *     responses:
 *       200:
 *         description: Updated category
 *       400:
 *         description: Validation or business error (controller returns error.message)
 *       401:
 *         description: Missing or invalid auth token
 *       404:
 *         description: Category not found
 *       500:
 *         description: Internal server error
 */
router.patch("/:id", authenticateToken, validateSchema(categoryUpdateSchema), categoryController.update);

/**
 * @openapi
 * /categories/{id}:
 *   delete:
 *     summary: Delete a category
 *     tags:
 *       - Categories
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
 *                   example: "Category deleted successfully"
 *       400:
 *         description: Validation or business error (controller returns error.message)
 *       401:
 *         description: Missing or invalid auth token
 *       404:
 *         description: Category not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:id", authenticateToken, categoryController.delete);

export default router;
