import express from "express";
import dotenv from "dotenv";
import gemini_call from "./routes/gemini-call.js";
import mongoose from "mongoose";
import update_summary from "./routes/updateSummary.js";
import get_summary from "./routes/getSummary.js";
import connectDB from "./config/db.js";

dotenv.config();
const app = express();
app.use(express.json());

// mount router
app.use("/chat", gemini_call);
// connect DB
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

// Routes
app.use("/summary", update_summary);
app.use("/summary", get_summary);
const port = process.env.PORT || 3000;
async function startServer() {
  await connectDB();

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

startServer();
