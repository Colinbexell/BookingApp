const mongoose = require("mongoose");
const { Schema } = mongoose;

const bookingArchiveSchema = new Schema(
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

    customerName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },

    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true, index: true },
    durationSlots: { type: Number, required: true },

    bookingUnit: {
      type: String,
      enum: ["per_lane", "per_person"],
      default: "per_lane",
      index: true,
    },

    partySize: { type: Number, default: 1 },

    status: {
      type: String,
      enum: ["active", "cancelled"],
      default: "active",
      index: true,
    },

    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid"],
      default: "unpaid",
      index: true,
    },

    paymentMethod: {
      type: String,
      enum: ["onsite", "online"],
      required: true,
    },

    currency: { type: String, default: "SEK" },
    unitPrices: { type: [Number], default: [] },
    totalPrice: { type: Number, default: 0 },

    archivedAt: { type: Date, default: Date.now, index: true },

    // behåll original timestamps för lead-time m.m.
    createdAt: { type: Date, required: true, index: true },
    updatedAt: { type: Date, required: true },
  },
  { timestamps: false },
);

module.exports = mongoose.model("BookingArchive", bookingArchiveSchema);
