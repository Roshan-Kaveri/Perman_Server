import { Router } from "express";
import Monthly from "../models/monthlySummary.js";
import Yearly from "../models/yearlySummary.js";

const router = Router();

// -------------------------------------------
// GET /summary/month?userId=&year=&month=
// -------------------------------------------
router.get("/month", async (req, res) => {
  const { userId, year, month } = req.query;

  if (!userId || !year || !month)
    return res.status(400).json({ error: "Missing query parameters" });

  const summary = await Monthly.findOne({ userId, year, month });

  if (!summary) return res.json({ message: "No Summary found" });

  res.json(summary);
});

// -------------------------------------------
// GET /summary/year?userId=&year=
// -------------------------------------------
router.get("/year", async (req, res) => {
  const { userId, year } = req.query;

  if (!userId || !year)
    return res.status(400).json({ error: "Missing query parameters" });

  const summary = await Yearly.findOne({ userId, year });

  if (!summary) return res.json({ message: "No Summary found" });

  res.json(summary);
});

export default router;
