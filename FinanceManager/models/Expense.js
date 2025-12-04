// models/Expense.js
import mongoose from "mongoose";

const ExpenseSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true }, // ⭐ user reference
    amount: { type: Number, required: true },
    type: { type: String, required: true },
    note: { type: String },
    date: { type: String, required: true },
    req: {
      type: String,
      enum: ["low", "medium", "high", "avoidable"],
      default: "low",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Expense", ExpenseSchema);
