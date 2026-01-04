const mongoose = require("mongoose");
const { Schema } = mongoose;

const weeklyAvailabilitySchema = new Schema(
  {
    day: { type: Number, required: true }, // 0=sön, 6=lör
    open: { type: String, required: true }, // "13:00"
    close: { type: String, required: true }, // "17:00"
  },
  { _id: false }
);

const exceptionSchema = new Schema(
  {
    date: { type: String, required: true }, // "2026-01-06"
    closed: { type: Boolean, default: false },
    open: String, // optional
    close: String, // optional
    reason: String,
  },
  { _id: false }
);

const activitySchema = new Schema(
  {
    title: { type: String, required: true },
    information: { type: String, required: true },
    imageUrl: { type: String, required: true },

    tracks: { type: Number, required: true }, // kapacitet per slot

    workshopId: {
      type: Schema.Types.ObjectId,
      ref: "Workshop",
      required: true,
    },

    bookingRules: {
      slotMinutes: { type: Number, default: 60 },
      minSlots: { type: Number, default: 1 },
      maxSlots: { type: Number, default: 2 },
    },

    useWorkshopAvailability: { type: Boolean, default: true },

    // används bara om useWorkshopAvailability === false
    availability: {
      weekly: { type: [weeklyAvailabilitySchema], default: undefined },
      exceptions: { type: [exceptionSchema], default: undefined },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Activity", activitySchema);
