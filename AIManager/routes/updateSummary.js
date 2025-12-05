import { Router } from "express";
import Monthly from "../models/monthlySummary.js";
import Yearly from "../models/yearlySummary.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ------------------------------------------------
// SAFE GEMINI GENERATION WITH RETRY
// ------------------------------------------------
async function safeGenerate(model, prompt, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await model.generateContent(prompt);
    } catch (err) {
      if (err.status === 503 || err.status === 429) {
        const delay = 500 * (i + 1);
        console.warn(
          `Gemini overloaded (retry ${i + 1}/${retries}), waiting ${delay}ms`
        );
        await new Promise((res) => setTimeout(res, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Gemini failed after retries");
}

// ------------------------------------------------
// FALLBACK SUMMARIES
// ------------------------------------------------
function fallbackMonthlySummary(trans, month, year) {
  const total = trans.reduce((sum, t) => sum + t.amount, 0);
  return `Summary for ${month}/${year}: Total spending ₹${total}.`;
}

function fallbackYearlySummary(monthSummaries, year) {
  return `Yearly summary for ${year}. Months recorded: ${monthSummaries.length}.`;
}

// ------------------------------------------------
// MAIN ROUTE
// ------------------------------------------------
router.post("/update", async (req, res) => {
  try {
    const { transactions, year, month, userId } = req.body;

    if (!transactions?.length)
      return res.status(400).json({ error: "Transactions list required" });

    if (!year || !month || !userId)
      return res.status(400).json({ error: "Missing year/month/userId" });

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // -----------------------------------------
    // PREPARE CLEAN TRANSACTION TEXT
    // -----------------------------------------
    const monthText = transactions
      .map((t) => `${t.type}: ₹${t.amount} on ${t.date}`)
      .join("\n");

    // -----------------------------------------
    // MONTHLY SUMMARY FIRST (STRICT ORDER)
    // -----------------------------------------
    let monthlySummary = "";
    const monthlyPrompt = `
Act as a Chartered Accountant.
Summarize spending for ${month}/${year}.
Transactions:
${monthText}

Write short, clean, helpful insights.
Mention bad spending patterns + 1–2 financial tips.
    `;

    try {
      const result = await safeGenerate(model, monthlyPrompt);
      monthlySummary = result.response.text();
    } catch (err) {
      console.error("Monthly AI failed, fallback:", err.message);
      monthlySummary = fallbackMonthlySummary(transactions, month, year);
    }

    // SAVE MONTHLY SUMMARY BEFORE YEARLY PROCESS
    await Monthly.updateOne(
      { userId, year, month },
      { summary: monthlySummary, updatedAt: new Date() },
      { upsert: true }
    );

    // -----------------------------------------
    // AFTER MONTHLY SAVE → YEARLY SUMMARY
    // -----------------------------------------
    let yearlySummary = "";

    // 1. Fetch all monthly summaries (latest versions)
    const allMonthly = await Monthly.find({ userId, year }).sort({ month: 1 });

    // 2. Combine minimal text
    const combined = allMonthly
      .map((m) => `${m.month}: ${m.summary}`)
      .join("\n");

    const yearlyPrompt = `
Create a clean YEARLY financial summary for ${year}.
Use these monthly summaries:
${combined}

Keep short, structured: total spending pattern, improvement areas, advice.
    `;

    try {
      const yr = await safeGenerate(model, yearlyPrompt);
      yearlySummary = yr.response.text();
    } catch (err) {
      console.error("Yearly AI failed, fallback:", err.message);
      yearlySummary = fallbackYearlySummary(allMonthly, year);
    }

    // 3. Save yearly summary
    await Yearly.updateOne(
      { userId, year },
      { summary: yearlySummary, updatedAt: new Date() },
      { upsert: true }
    );

    // -----------------------------------------
    // RETURN (fast response, no delay)
    // -----------------------------------------
    res.json({
      message: "AI monthly + yearly summary updated (sequential + safe)",
      monthlySummary,
      yearlySummary,
    });
  } catch (err) {
    console.error("AI Summary Error (Crash Safe):", err);
    res.status(200).json({
      message: "Summary update partial. AI may be overloaded.",
      monthlySummary: "AI temporarily unavailable",
    });
  }
});

export default router;
