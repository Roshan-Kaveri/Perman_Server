import { Router } from "express";
import Monthly from "../models/monthlySummary.js";
import Yearly from "../models/yearlySummary.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// -------------------------------------------
// POST /summary
// Body: { transactions: [], year, month, userId }
// -------------------------------------------
router.post("/", async (req, res) => {
  try {
    const { transactions, year, month, userId } = req.body;

    if (!transactions || !year || !month || !userId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const textData = transactions
      .map((tx) => `${tx.date}: ${tx.type} of ${tx.amount}`)
      .join("\n");

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // ---- Monthly summary AI prompt ----
    const monthlyPrompt = `
Summarize these transactions for ${month}/${year}:

${textData}
`;

    const monthlyResult = await model.generateContent(monthlyPrompt);
    const monthlySummary = monthlyResult.response.text();

    // Save monthly summary
    await Monthly.updateOne(
      { userId, year, month },
      {
        summary: monthlySummary,
        updatedAt: new Date(),
      },
      { upsert: true }
    );

    // ---- Yearly summary AI prompt ----
    const yearlyPrompt = `
Summarize all transactions for year ${year}:

${textData}
`;

    const yearlyResult = await model.generateContent(yearlyPrompt);
    const yearlySummary = yearlyResult.response.text();

    await Yearly.updateOne(
      { userId, year },
      {
        summary: yearlySummary,
        updatedAt: new Date(),
      },
      { upsert: true }
    );

    res.json({
      message: "Summaries updated successfully",
      monthlySummary,
      yearlySummary,
    });
  } catch (err) {
    console.error("Summary Error:", err);
    res.status(500).json({ error: "AI Summary generation failed" });
  }
});

export default router;
