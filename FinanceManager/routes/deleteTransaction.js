// routes/deleteExpense.routes.js
import express from "express";
import Expense from "../models/Expense.js";
import axios from "axios";

const router = express.Router();

// AI service base URL
const AI_SERVICE_URL = "http://127.0.0.1:3002/summary/update";

// ------------------------------------
// Fire & forget AI trigger
// ------------------------------------
const triggerAISummaryUpdate = async (payload) => {
  try {
    axios.post(AI_SERVICE_URL, payload).catch((err) => {
      console.error("AI Service Failed (background):", err.message);
    });
  } catch (err) {
    console.error("AI Trigger Error:", err.message);
  }
};

// ------------------------------------
// DELETE EXPENSE
// ------------------------------------
router.delete("/deleteTransaction/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // ---------- Find & delete transaction ----------
    const deletedExpense = await Expense.findByIdAndDelete(id);
    if (!deletedExpense) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // ---------- Extract details ----------
    const { userId, date } = deletedExpense;
    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;

    // ---------- Fetch updated month transactions ----------
    const monthTx = await Expense.find({
      userId,
      date: { $regex: `^${year}-${String(month).padStart(2, "0")}` },
    });

    // ---------- Trigger AI update (non-blocking) ----------
    triggerAISummaryUpdate({
      userId,
      year,
      month,
      transactions: monthTx,
    });

    // ---------- Respond immediately ----------
    res.json({
      message:
        "Transaction deleted successfully. AI update running in background.",
      deletedId: id,
    });
  } catch (err) {
    console.error("Delete Transaction Error:", err);
    res.status(500).json({ error: "Failed to delete transaction" });
  }
});

export default router;
