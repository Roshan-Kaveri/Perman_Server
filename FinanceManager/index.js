import express from "express";
import check_auth from "./middlewares/auth_checker.js";
import connectDB from "./config/db.js";
import Expense from "./models/Expense.js";
import getTransactionRoute from "./routes/getTransactions.js";
import addTransactionRoute from "./routes/addTransactions.js";
import deleteExpenseRoutes from "./routes/deleteTransaction.js";

import cors from "cors";

const app = express();
const PORT = 3001;

app.use(express.json());
app.use(cors());
async function startServer() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  console.log(await Expense.find().select());
}

startServer();

app.get("/api/", check_auth, (req, res) => {
  res.send("Hello from Express!");
});

app.use("/api/", getTransactionRoute);
app.use("/api/", addTransactionRoute);
app.use("/api/", deleteExpenseRoutes);

app.post("/api/data", (req, res) => {
  res.json({
    message: "Received successfully",
    yourData: req.body,
  });
});
