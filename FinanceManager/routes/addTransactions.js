import express from "express";
import Expense from "../models/Expense.js";
import axios from "axios";

const router = express.Router();

// AI service base URL
const AI_SERVICE_URL = "http://127.0.0.1:3002/summary/update";

// Fire & forget helper (no await, no blocking)
const triggerAISummaryUpdate = async (payload) => {
  try {
    axios.post(AI_SERVICE_URL, payload).catch((err) => {
      console.error("AI Service Failed (background):", err.message);
    });
  } catch (err) {
    console.error("AI Trigger Error:", err.message);
  }
};

router.post("/addExpense", async (req, res) => {
  try {
    const expense = await Expense.create(req.body);

    // ---------- Extract details ----------
    const { userId, date } = req.body;
    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;

    // ---------- Fetch monthly transactions ----------
    const monthTx = await Expense.find({
      userId,
      date: { $regex: `^${year}-${String(month).padStart(2, "0")}` },
    });

    // ---------- Trigger AI update in background ----------
    triggerAISummaryUpdate({
      userId,
      year,
      month,
      transactions: monthTx,
    });

    // ---------- Return without waiting ----------
    res.json({
      message: "Expense added successfully. AI update running in background.",
      expense,
    });
  } catch (err) {
    console.error("Add Expense Error:", err);
    res.status(500).json({ error: "Failed to add expense" });
  }
});

export default router;
