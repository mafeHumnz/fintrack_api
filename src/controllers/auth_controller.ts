import { Request, Response } from "express";
import { authService } from "../services/auth_service.js";

export class AuthController {
    async register(req: Request, res: Response) {
        try {
            const user = await authService.register(req.body);
            res.status(201).json(user);
        } catch (error) {

            if (error instanceof Error) {
                res.status(400).json({message: error.message});
            } else {
                res.status(500).json({message: "Internal server error"});
            }
        }
    }
    
    async login(req: Request, res: Response) {
        try {
            const {token} = await authService.login(req.body);
            res.status(200).json({token});
        } catch (error) {
            if (error instanceof Error) {
                res.status(400).json({message: error.message});
            } else {
                res.status(500).json({message: "Internal server error"});
            }
        }
    }
}

export const authController = new AuthController();