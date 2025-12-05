import mongoose from "mongoose";

const yearlySchema = new mongoose.Schema({
  userId: String,
  year: Number,
  summary: String,
  updatedAt: { type: Date, default: Date.now },
});

yearlySchema.index({ userId: 1, year: 1 }, { unique: true });

export default mongoose.model("YearlyAISummary", yearlySchema);
