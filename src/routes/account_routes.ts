import {Router} from "express";
import { accountController } from "../controllers/account_controller.js";
import { authenticateToken } from "../middlewares/protect_middleware.js";
import { accountSchema, accountUpdateSchema } from "../schemas/account_schema.js";
import { validateSchema } from "../middlewares/auth_middleware.js";

const router = Router();

router.post("/", authenticateToken, validateSchema(accountSchema), accountController.create);
router.get("/", authenticateToken, accountController.findAll);
router.get("/:id", authenticateToken, accountController.findById);
router.patch("/:id", authenticateToken, validateSchema(accountUpdateSchema), accountController.update);
router.delete("/:id", authenticateToken, accountController.delete);

export default router;