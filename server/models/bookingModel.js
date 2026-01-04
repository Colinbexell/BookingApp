const mongoose = require("mongoose");
const { Schema } = mongoose;

const bookingSchema = new Schema(
  {
    activityId: {
      type: Schema.Types.ObjectId,
      ref: "Activity",
      required: true,
    },
    workshopId: {
      type: Schema.Types.ObjectId,
      ref: "Workshop",
      required: true,
    },

    startAt: { type: Date, required: true }, // UTC i DB
    endAt: { type: Date, required: true }, // UTC i DB

    durationSlots: { type: Number, required: true }, // 1 eller 2
    slotMinutes: { type: Number, required: true }, // t.ex 60

    // (valfritt för senare)
    customerName: String,
    customerEmail: String,
    customerPhone: String,

    status: { type: String, enum: ["active", "cancelled"], default: "active" },
  },
  { timestamps: true }
);

// För snabb availability-sökning
bookingSchema.index({ activityId: 1, startAt: 1, endAt: 1, status: 1 });

module.exports = mongoose.model("Booking", bookingSchema);
