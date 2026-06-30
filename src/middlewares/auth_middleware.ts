import { request, response, NextFunction } from "express";
import {ZodType} from "zod";

export function validateSchema(schema: ZodType) {
    return (req: typeof request, res: typeof response, next: NextFunction) => {
        try {
            schema.parse(req.body);
            next();
        } catch (error) {
            if (error instanceof Error) {
                res.status(400).json({message: error.message});
            } else {
                res.status(500).json({message: "Internal server error"});
            }
        }
    };
}   