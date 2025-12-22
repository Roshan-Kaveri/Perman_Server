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
// NEW → Compute accurate totals BEFORE sending to AI
// ------------------------------------------------
function computeTotals(transactions) {
  let totalSpent = 0;
  let totalReceived = 0;

  transactions.forEach((t) => {
    const amt = Number(t.amount);
    if (amt < 0) totalSpent += Math.abs(amt);
    else totalReceived += amt;
  });

  return {
    totalSpent,
    totalReceived,
    netBalance: totalReceived - totalSpent,
  };
}

// ------------------------------------------------
// MAIN ROUTE
// ------------------------------------------------
router.post("/update", async (req, res) => {
  try {
    console.log("recieved req");
    const { transactions, year, month, userId } = req.body;

    if (!transactions?.length)
      return res.status(400).json({ error: "Transactions list required" });

    if (!year || !month || !userId)
      return res.status(400).json({ error: "Missing year/month/userId" });

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // -----------------------------------------
    // 1. NEW — Safe numeric preprocessing
    // -----------------------------------------
    const { totalSpent, totalReceived, netBalance } =
      computeTotals(transactions);

    const notes = transactions
      .map(
        (t) => `• ${t.note || "No note"} (₹${t.amount}, ${t.type}, ${t.req})`
      )
      .join("\n");

    // -----------------------------------------
    // 2. PREPARE CLEAN TRANSACTION TEXT (unchanged)
    // -----------------------------------------
    const monthText = transactions
      .map((t) => `${t.type}: ₹${t.amount} on ${t.date}`)
      .join("\n");

    // -----------------------------------------
    // MONTHLY SUMMARY (STRICT ORDER)
    // -----------------------------------------
    let monthlySummary = "";

    // NEW → AI prompt improved, includes precomputed totals
    const monthlyPrompt = `
You are a financial assistant.

IMPORTANT RULES:
- DO NOT calculate totals yourself.
- ONLY use the computed values provided below.
- Use notes for behavior interpretation, not for calculations.

Precomputed financial totals:
• Total Spent: ₹${totalSpent}
• Total Received: ₹${totalReceived}
• Net Balance: ₹${netBalance}

Transactions:
${monthText}

Additional Notes:
${notes}

TASK:
Write a 50 word monthly financial summary.
Include:
- spending behaviour
- good or bad patterns
- insights based on notes
- 1–2 practical improvements
Avoid repeating the same number multiple times.
    `;

    try {
      const result = await safeGenerate(model, monthlyPrompt);
      monthlySummary = result.response.text();
    } catch (err) {
      console.error("Monthly AI failed, fallback:", err.message);
      monthlySummary = fallbackMonthlySummary(transactions, month, year);
    }

    // SAVE MONTHLY SUMMARY
    await Monthly.updateOne(
      { userId, year, month },
      {
        summary: monthlySummary,
        totalSpent,
        totalReceived,
        netBalance,
        updatedAt: new Date(),
      },
      { upsert: true }
    );

    // -----------------------------------------
    // YEARLY SUMMARY
    // -----------------------------------------
    let yearlySummary = "";
    const allMonthly = await Monthly.find({ userId, year }).sort({ month: 1 });

    const combined = allMonthly
      .map((m) => `${m.month}: ${m.summary}`)
      .join("\n");

    const yearlyPrompt = `
Write a structured YEARLY summary for ${year} based on monthly summaries.

RULES:
- Do NOT calculate totals.
- Highlight patterns across months.
- Mention improvements & behaviour changes.
- Keep it clean, factual, professional.
- 50 words limit

Monthly summaries:
${combined}
    `;

    try {
      const yr = await safeGenerate(model, yearlyPrompt);
      yearlySummary = yr.response.text();
    } catch (err) {
      console.error("Yearly AI failed, fallback:", err.message);
      yearlySummary = fallbackYearlySummary(allMonthly, year);
    }

    await Yearly.updateOne(
      { userId, year },
      { summary: yearlySummary, updatedAt: new Date() },
      { upsert: true }
    );

    // -----------------------------------------
    // FINAL RESPONSE (same as before)
    // -----------------------------------------
    res.json({
      message: "AI monthly + yearly summary updated",
      monthlySummary,
      yearlySummary,
      totalSpent,
      totalReceived,
      netBalance,
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
