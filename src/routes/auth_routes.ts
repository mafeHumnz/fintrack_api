import {Router} from "express";
import { loginLimiter, registerLimiter } from "../middlewares/rate_limiters.js";
import { authController } from "../controllers/auth_controller.js";
import { validateSchema } from "../middlewares/auth_middleware.js";
import {registerSchema, loginSchema} from "../schemas/auth_schema.js";

const router = Router();

router.post("/register", registerLimiter, validateSchema(registerSchema), authController.register);
router.post("/login", loginLimiter, validateSchema(loginSchema), authController.login);

export default router;