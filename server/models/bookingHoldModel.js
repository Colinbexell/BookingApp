const mongoose = require("mongoose");
const { Schema } = mongoose;

const bookingHoldSchema = new Schema(
  {
    holdId: { type: String, required: true, unique: true, index: true },
    workshopId: {
      type: Schema.Types.ObjectId,
      ref: "Workshop",
      required: true,
      index: true,
    },

    customerName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },

    // Draft items
    items: {
      type: [
        {
          activityId: {
            type: Schema.Types.ObjectId,
            ref: "Activity",
            required: true,
          },
          startISO: { type: String, required: true },
          durationSlots: { type: Number, required: true },
          partySize: { type: Number, default: 1 },
        },
      ],
      default: [],
    },

    // Pricing snapshot (så Stripe-beloppet är låst)
    currency: { type: String, default: "SEK" },
    totalPrice: { type: Number, default: 0 },

    stripeCheckoutSessionId: { type: String, index: true },
    stripePaymentIntentId: { type: String, index: true },

    // Auto-delete efter t.ex. 15 min
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true },
);

bookingHoldSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("BookingHold", bookingHoldSchema);
