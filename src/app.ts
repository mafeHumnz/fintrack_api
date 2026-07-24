import express from "express";
import authRoutes from "./routes/auth_routes.js";
import accountRoutes from "./routes/account_routes.js";
import categoryRoutes from "./routes/category_routes.js";
import transactionRoutes from "./routes/transaction_routes.js";

const app = express();

app.use(express.json());

app.use("/auth", authRoutes);
app.use("/accounts", accountRoutes);
app.use("/categories", categoryRoutes);
app.use("/transactions", transactionRoutes);


export default app;