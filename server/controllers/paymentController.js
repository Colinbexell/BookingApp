const crypto = require("crypto");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const Booking = require("../models/bookingModel");
const BookingHold = require("../models/bookingHoldModel");
const Activity = require("../models/activityModel");
const mongoose = require("mongoose");

// --- Helpers (kopierade från bookingController för säker priskalkyl) ---
const hhmmToMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const pad2 = (n) => String(n).padStart(2, "0");
const toISODate = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const getPriceForSlot = ({ pricingRules, dateISO, startHHMM }) => {
  const fallback = pricingRules?.defaultPricePerHour ?? 0;

  const ex = (pricingRules?.exceptions || []).find((e) => e.date === dateISO);
  if (ex?.closed)
    return { pricePerHour: 0, currency: pricingRules?.currency || "SEK" };

  const ranges = ex?.ranges?.length
    ? ex.ranges
    : (() => {
        const weekday = new Date(dateISO + "T00:00:00").getDay();
        const w = (pricingRules?.weekly || []).find((x) => x.day === weekday);
        return w?.ranges || [];
      })();

  const t = hhmmToMinutes(startHHMM);

  for (const r of ranges) {
    const a = hhmmToMinutes(r.start);
    const b = hhmmToMinutes(r.end);
    if (a <= t && t < b) {
      return {
        pricePerHour: Number(r.pricePerHour),
        currency: pricingRules?.currency || "SEK",
      };
    }
  }

  return {
    pricePerHour: Number(fallback),
    currency: pricingRules?.currency || "SEK",
  };
};

const calcItemTotal = ({ act, startISO, durationSlots, partySize }) => {
  const slotMinutes = act.bookingRules?.slotMinutes || 60;
  const slots = Number(durationSlots);

  const startAt = new Date(startISO);
  if (Number.isNaN(startAt.getTime())) {
    throw new Error("startISO invalid date");
  }

  const ps = Math.max(1, Number(partySize || 1));

  if (act.bookingUnit === "per_person") {
    const minP = Number(act.partyRules?.min ?? 1);
    const maxP = Number(act.partyRules?.max ?? 99);

    if (ps < minP || ps > maxP) {
      throw new Error(`partySize must be between ${minP} and ${maxP}`);
    }
  }

  const unitPrices = [];
  for (let i = 0; i < slots; i++) {
    const slotStart = new Date(startAt.getTime() + i * slotMinutes * 60_000);
    const dateISO = toISODate(slotStart);

    const startHHMM = slotStart.toLocaleTimeString("sv-SE", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const { pricePerHour } = getPriceForSlot({
      pricingRules: act.pricingRules,
      dateISO,
      startHHMM,
    });

    const slotPrice = Math.round(pricePerHour * (slotMinutes / 60) * 100) / 100;
    unitPrices.push(slotPrice);
  }

  const baseTotal =
    Math.round(unitPrices.reduce((a, b) => a + b, 0) * 100) / 100;

  let totalPrice = baseTotal;
  if (act.bookingUnit === "per_person") {
    totalPrice = Math.round(baseTotal * ps * 100) / 100;
  }

  const isPaid = act.takesPayment !== false;
  if (!isPaid) {
    totalPrice = 0;
  }

  return { totalPrice, currency: act.pricingRules?.currency || "SEK" };
};

const createCheckoutSession = async (req, res) => {
  try {
    const { workshopId, items, customer } = req.body;

    if (!workshopId)
      return res.status(400).json({ message: "workshopId is required" });

    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ message: "items is required" });

    if (
      !customer?.customerName?.trim() ||
      !customer?.email?.trim() ||
      !customer?.phone?.trim()
    ) {
      return res.status(400).json({ message: "customer fields required" });
    }

    // 1) Räkna total server-side (låser beloppet)
    let currency = "SEK";
    let total = 0;

    for (const it of items) {
      const { activityId, startISO, durationSlots, partySize } = it;

      if (!activityId || !startISO || !durationSlots) {
        return res.status(400).json({
          message: "Each item needs activityId/startISO/durationSlots",
        });
      }

      const act = await Activity.findById(activityId).select(
        "workshopId bookingRules pricingRules bookingUnit partyRules takesPayment",
      );

      if (!act) return res.status(400).json({ message: "Invalid activityId" });

      // säkerställ att aktiviteten tillhör workshopen
      if (String(act.workshopId) !== String(workshopId)) {
        return res
          .status(400)
          .json({ message: "Activity not in this workshop" });
      }

      const { totalPrice, currency: c } = calcItemTotal({
        act,
        startISO,
        durationSlots,
        partySize,
      });

      currency = c || currency;
      total += Number(totalPrice || 0);
    }

    total = Math.round(total * 100) / 100;
    const amountMinor = Math.round(total * 100);

    // 2) Skapa HOLD (inte bokning) med TTL 15 min
    const holdId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await BookingHold.create({
      holdId,
      workshopId,
      customerName: customer.customerName.trim(),
      email: customer.email.trim().toLowerCase(),
      phone: customer.phone.trim(),
      items,
      currency,
      totalPrice: total,
      expiresAt,
    });

    // 3) Skapa Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: { name: "Bokning" },
            unit_amount: amountMinor,
          },
          quantity: 1,
        },
      ],
      customer_email: customer.email.trim().toLowerCase(),
      // success_url: `${process.env.CLIENT_URL}/payment/success?hold=${holdId}`,
      // cancel_url: `${process.env.CLIENT_URL}/payment/cancelled?hold=${holdId}`,
      success_url: `${process.env.CLIENT_URL}`,
      cancel_url: `${process.env.CLIENT_URL}`,
      metadata: {
        holdId,
        workshopId: String(workshopId),
      },
    });

    await BookingHold.updateOne(
      { holdId },
      { $set: { stripeCheckoutSessionId: session.id } },
    );

    return res.json({ url: session.url });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const webhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const holdId = session.metadata?.holdId;
      const paymentIntentId = session.payment_intent;

      if (!holdId) return res.json({ received: true });

      const hold = await BookingHold.findOne({ holdId }).lean();
      if (!hold) {
        // hold kan ha TTL-rensats eller redan hanterats
        return res.json({ received: true });
      }

      // Skapa bokningar som PAID (online)
      const created = [];

      for (const it of hold.items) {
        const act = await Activity.findById(it.activityId).select(
          "workshopId bookingRules pricingRules tracks bookingUnit partyRules takesPayment",
        );

        if (!act) continue;

        // Recalc tider
        const slotMinutes = act.bookingRules?.slotMinutes || 60;
        const slots = Number(it.durationSlots);
        const startAt = new Date(it.startISO);
        const endAt = new Date(
          startAt.getTime() + slots * slotMinutes * 60_000,
        );

        // Kapacitets-check i betalningsögonblicket (viktigt!)
        const overlapping = await Booking.find({
          activityId: act._id,
          status: "active",
          startAt: { $lt: endAt },
          endAt: { $gt: startAt },
        }).select("_id");

        const capacity = Number(act.tracks || 0);
        if (overlapping.length + 1 > capacity) {
          // Här har kunden betalat men tiden är full.
          // Production-lösning är att reservera kapacitet under hold.
          // Vi skippar skapande så admin inte får “fel” bokning.
          continue;
        }

        // Priskalkyl igen (så DB alltid kan stå på egna ben)
        const { totalPrice, currency } = calcItemTotal({
          act,
          startISO: it.startISO,
          durationSlots: it.durationSlots,
          partySize: it.partySize,
        });

        const doc = await Booking.create({
          workshopId: act.workshopId,
          activityId: act._id,

          customerName: hold.customerName,
          email: hold.email,
          phone: hold.phone,

          startAt,
          endAt,
          durationSlots: slots,

          bookingUnit: act.bookingUnit || "per_lane",
          partySize: Math.max(1, Number(it.partySize || 1)),

          paymentMethod: "online",
          paymentStatus: "paid",

          paymentGroupId: holdId,
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: paymentIntentId,

          currency: currency || hold.currency || "SEK",
          unitPrices: [],
          totalPrice: Number(totalPrice || 0),
        });

        created.push(doc);
      }

      // Städa holden (oavsett)
      await BookingHold.deleteOne({ holdId });
    }
    if (event.type === "refund.updated") {
      const refund = event.data.object;
      if (refund?.id) {
        await Booking.updateMany(
          { stripeRefundId: refund.id },
          { $set: { refundStatus: refund.status } },
        );
      }
    }

    return res.json({ received: true });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { createCheckoutSession, webhook };
