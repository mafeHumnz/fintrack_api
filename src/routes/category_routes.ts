import {Router} from "express";
import { categoryController } from "../controllers/category_controller.js";
import { authenticateToken } from "../middlewares/protect_middleware.js";
import { categorySchema, categoryUpdateSchema } from "../schemas/category_schema.js";
import { validateSchema } from "../middlewares/auth_middleware.js";

const router = Router();

router.post("/", authenticateToken, validateSchema(categorySchema), categoryController.create);
router.get("/", authenticateToken, categoryController.findAll);
router.get("/:id", authenticateToken, categoryController.findById);
router.patch("/:id", authenticateToken, validateSchema(categoryUpdateSchema), categoryController.update);
router.delete("/:id", authenticateToken, categoryController.delete);

export default router;
