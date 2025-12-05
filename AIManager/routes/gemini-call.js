// routes/chat.js
import { Router } from "express";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const router = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

router.get("/", async (req, res) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(req.query.query);
    const text = result.response.text();

    res.send({ reply: text });
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: "Gemini request failed" });
  }
});

export default router;
