import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { env } from "../config/env.js";

interface TokenPayload extends JwtPayload {
    userId: string;
}

export async function authenticateToken(
    req: Request,
    res: Response,
    next: NextFunction
) {

    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            message: "Authorization token is required",
        });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            message: "Invalid authorization header",
        });
    }

    try {

        const decoded = jwt.verify(
            token,
            env.JWT_SECRET
        ) as TokenPayload;

        req.user = {
            id: decoded.userId,
        };

        next();

    } catch {

        return res.status(401).json({
            message: "Invalid or expired token",
        });

    }
}