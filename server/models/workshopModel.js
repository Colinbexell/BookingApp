const mongoose = require("mongoose");
const { Schema } = mongoose;

const weeklyAvailabilitySchema = new Schema(
  {
    day: { type: Number, required: true }, // 0=sön ... 6=lör
    open: { type: String, required: true }, // "13:00"
    close: { type: String, required: true }, // "17:00"
  },
  { _id: false }
);

const exceptionSchema = new Schema(
  {
    date: { type: String, required: true }, // "2026-01-06"
    closed: { type: Boolean, default: false },
    open: String,
    close: String,
    reason: String,
  },
  { _id: false }
);

const workshopSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    name: { type: String, required: true },

    availability: {
      weekly: [weeklyAvailabilitySchema],
      exceptions: [exceptionSchema],
    },
  },
  { timestamps: true }
);

const WorkshopModel = mongoose.model("Workshop", workshopSchema);

module.exports = WorkshopModel;
