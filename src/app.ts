import express from "express";
import helmet from "helmet";
import {globalLimiter} from "./middlewares/rate_limiters.js";
import authRoutes from "./routes/auth_routes.js";
import accountRoutes from "./routes/account_routes.js";
import categoryRoutes from "./routes/category_routes.js";
import transactionRoutes from "./routes/transaction_routes.js";
import budgetRoutes from "./routes/budget_routes.js";
import goalRoutes from "./routes/goal_routes.js";

const app = express();

app.use(helmet());
app.use(globalLimiter);
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/accounts", accountRoutes);
app.use("/categories", categoryRoutes);
app.use("/transactions", transactionRoutes);
app.use("/budgets", budgetRoutes);
app.use("/goals", goalRoutes);


export default app;