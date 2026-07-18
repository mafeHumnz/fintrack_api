import express from "express";
import authRoutes from "./routes/auth_routes.js";
import accountRoutes from "./routes/account_routes.js";

const app=express();

app.use(
  express.json()
);

app.use("/auth", authRoutes);
app.use("/accounts", accountRoutes);


export default app;