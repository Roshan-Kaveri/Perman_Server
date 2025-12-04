import express from "express";
import Expense from "../models/Expense.js";

const router = express.Router();

router.post("/addExpense", async (req, res) => {
  try {
    const expense = await Expense.create(req.body);
    res.json(expense);
  } catch (err) {
    res.status(500).json({ error: "Failed to add expense" });
  }
});

export default router;
