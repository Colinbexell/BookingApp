const mongoose = require("mongoose");
const { Schema } = mongoose;

const bookingSchema = new Schema(
  {
    workshopId: {
      type: Schema.Types.ObjectId,
      ref: "Workshop",
      required: true,
      index: true,
    },

    activityId: {
      type: Schema.Types.ObjectId,
      ref: "Activity",
      required: true,
      index: true,
    },

    // Kundinfo (från "ange info"-sidan)
    customerName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },

    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true, index: true },
    durationSlots: { type: Number, required: true }, // 1 eller 2

    // Status för bokning
    status: {
      type: String,
      enum: ["active", "cancelled"],
      default: "active",
      index: true,
    },

    // Betalning
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid"],
      default: "unpaid",
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ["onsite", "online"],
      required: true, // onsite = betala på plats, online = betala direkt
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", bookingSchema);
