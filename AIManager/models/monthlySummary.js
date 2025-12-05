import mongoose from "mongoose";

const monthlySchema = new mongoose.Schema({
  userId: String,
  year: Number,
  month: Number,
  summary: String,
  updatedAt: { type: Date, default: Date.now },
});

monthlySchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });

export default mongoose.model("MonthlyAISummary", monthlySchema);
