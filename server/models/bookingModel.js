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
    // Statistik & kapacitet
    bookingUnit: {
      type: String,
      enum: ["per_lane", "per_person"],
      default: "per_lane",
      index: true,
    },

    // antal personer i sällskapet (alltid sparat för statistik)
    partySize: { type: Number, default: 1 },

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
      enum: ["unpaid", "paid", "refunded"],
      default: "unpaid",
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ["onsite", "online"],
      required: true, // onsite = betala på plats, online = betala direkt
    },
    // Stripe (för onlinebetalning)
    paymentGroupId: { type: String, index: true }, // grupp för en hel "checkout"
    stripeCheckoutSessionId: { type: String, index: true },
    stripePaymentIntentId: { type: String, index: true },
    paymentExpiresAt: { type: Date, index: true },
    //  Refund-spårning (för betalda avbokningar)
    stripeRefundId: { type: String, index: true },
    refundAmount: { type: Number, default: 0 }, // i "major units" (t.ex. SEK)
    refundStatus: { type: String }, // pending|succeeded|failed
    refundedAt: { type: Date },

    currency: { type: String, default: "SEK" },
    unitPrices: { type: [Number], default: [] }, // pris per slot i bokningen
    totalPrice: { type: Number, default: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Booking", bookingSchema);
