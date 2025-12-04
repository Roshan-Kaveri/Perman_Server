import express from "express";
import Expense from "../models/Expense.js";

const router = express.Router();

// GET /getTransaction?userId=1
router.get("/getTransaction", async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const raw = await Expense.find({ userId })
      .sort({ createdAt: -1 })
      .select("-__v");

    const expenses = raw.map((item) => ({
      id: item._id, // 👈 convert here
      amount: item.amount,
      type: item.type,
      note: item.note,
      date: item.date,
      req: item.req,
      createdAt: item.createdAt,
    }));

    res.json(expenses);
  } catch (err) {
    console.error("Error fetching transactions:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
