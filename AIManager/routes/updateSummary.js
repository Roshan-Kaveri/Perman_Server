import { Router } from "express";
import Monthly from "../models/monthlySummary.js";
import Yearly from "../models/yearlySummary.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

router.post("/update", async (req, res) => {
  try {
    const { transactions, year, month, userId } = req.body;

    if (!transactions || !Array.isArray(transactions) || !transactions.length) {
      return res.status(400).json({ error: "Transactions list is required" });
    }

    if (!year || !month || !userId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const textData = transactions
      .map((tx) => `${tx.date}: ${tx.type} of ${tx.amount}`)
      .join("\n");

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // ------------------------------
    // MONTHLY SUMMARY
    // ------------------------------
    const monthlyPrompt = `
Create a clear, friendly monthly summary for ${month}/${year} based on these transactions:

${textData}

Keep it simple, readable, and helpful.
`;

    const monthlyResult = await model.generateContent(monthlyPrompt);
    const monthlySummary = monthlyResult.response.text();

    await Monthly.updateOne(
      { userId, year, month },
      {
        summary: monthlySummary,
        updatedAt: new Date(),
      },
      { upsert: true }
    );

    // ------------------------------
    // YEARLY SUMMARY
    // ------------------------------
    const yearlyPrompt = `
Create a clear yearly financial summary for the year ${year}:

${textData}

Keep the tone simple and easy to understand.
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

    // ------------------------------
    // RESPONSE
    // ------------------------------
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
