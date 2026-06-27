import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({
  path: `.env.${process.env.NODE_ENV || "development"}`
});

const envSchema = z.object({
  NODE_ENV: z.enum([
    "development",
    "production",
    "test"
    ]).default("development"),

  PORT: z.coerce.number().default(3000),

  DATABASE_URL: z.url(),

  JWT_SECRET: z.string().min(8)
});

const parsedEnv = envSchema.safeParse(
  process.env
);

if (!parsedEnv.success) {
  console.error(parsedEnv.error.format());

  throw new Error(
    "Variables de entorno inválidas"
  );
}

export const env = parsedEnv.data;