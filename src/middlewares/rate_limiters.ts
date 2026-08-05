import rateLimit from "express-rate-limit";
import {env} from "../config/env.js";

export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.NODE_ENV === "test" ? 1000 : 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many login attempts, please try again later" },
});

export const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: env.NODE_ENV === "test" ? 1000 : 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many accounts created from this IP, please try again later" },
});

export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.NODE_ENV === "test" ? 10000 : 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests, please try again later" },
});