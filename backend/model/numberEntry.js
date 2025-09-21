import mongoose from "mongoose";

const numberEntrySchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true }, // Unique identifier
    numbers: {
      type: [Number],
      required: true,
      validate: [(arr) => arr.length <= 2, "Maximum 2 numbers allowed"],
    },
  },
  { timestamps: true }
);

const NumberEntry = mongoose.model("NumberEntry", numberEntrySchema);

export default NumberEntry;
