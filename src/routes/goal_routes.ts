import {Router} from "express";
import { goalController } from "../controllers/goal_controller.js";
import { authenticateToken } from "../middlewares/protect_middleware.js";
import { goalSchema, updateGoalSchema } from "../schemas/goal_schema.js";
import { validateSchema } from "../middlewares/auth_middleware.js";

const router = Router();

router.post("/", authenticateToken, validateSchema(goalSchema), goalController.create);
router.get("/", authenticateToken, goalController.findAll);
router.get("/:id", authenticateToken, goalController.findById);
router.patch("/:id", authenticateToken, validateSchema(updateGoalSchema), goalController.update);
router.delete("/:id", authenticateToken, goalController.delete);

export default router;