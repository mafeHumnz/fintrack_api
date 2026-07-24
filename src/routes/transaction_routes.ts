import {Router} from "express";
import { transactionController } from "../controllers/transaction_controller.js";
import { authenticateToken } from "../middlewares/protect_middleware.js";
import { transactionSchema, transactionUpdateSchema } from "../schemas/transaction_schema.js";
import { validateSchema } from "../middlewares/auth_middleware.js";

const router = Router();

router.post("/", authenticateToken, validateSchema(transactionSchema), transactionController.create);
router.get("/", authenticateToken, transactionController.findAll);
router.get("/:id", authenticateToken, transactionController.findById);
router.patch("/:id", authenticateToken, validateSchema(transactionUpdateSchema), transactionController.update);
router.delete("/:id", authenticateToken, transactionController.delete);

export default router;