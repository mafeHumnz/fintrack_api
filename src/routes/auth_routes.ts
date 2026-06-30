import {Router} from "express";
import { authController } from "../controllers/auth_controller.js";
import { validateSchema } from "../middlewares/auth_middleware.js";
import {registerSchema, loginSchema} from "../validators/auth.validator.js";

const router = Router();

router.post("/register", validateSchema(registerSchema), authController.register);
router.post("/login", validateSchema(loginSchema), authController.login);

export default router;