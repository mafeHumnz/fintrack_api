import {Router} from "express";
import { budgetController } from "../controllers/budget_controller.js";
import { authenticateToken } from "../middlewares/protect_middleware.js";
import { budgetSchema, budgetUpdateSchema } from "../schemas/budget_schema.js";
import { validateSchema } from "../middlewares/auth_middleware.js";

const router = Router();

router.post("/", authenticateToken, validateSchema(budgetSchema), budgetController.create);
router.get("/", authenticateToken, budgetController.findAll);
router.get("/:id", authenticateToken, budgetController.findById);
router.patch("/:id", authenticateToken, validateSchema(budgetUpdateSchema), budgetController.update);
router.delete("/:id", authenticateToken, budgetController.delete);

export default router;