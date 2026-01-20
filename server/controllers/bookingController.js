const Booking = require("../models/bookingModel");
const Activity = require("../models/activityModel");
const mongoose = require("mongoose");

// --- basic YYYY-MM-DD validator ---
const isValidDateISO = (s) =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

const makeLocalDate = (dateISO, hhmm) => {
  const [y, mo, da] = dateISO.split("-").map(Number);
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(y, mo - 1, da, h, m, 0, 0);
};

const pad2 = (n) => String(n).padStart(2, "0");
const toISODate = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const hhmmToMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const getPriceForSlot = ({ pricingRules, dateISO, startHHMM }) => {
  const fallback = pricingRules?.defaultPricePerHour ?? 0;

  const ex = (pricingRules?.exceptions || []).find((e) => e.date === dateISO);
  if (ex?.closed)
    return { pricePerHour: 0, currency: pricingRules?.currency || "SEK" };

  const ranges = ex?.ranges?.length
    ? ex.ranges
    : (() => {
        const weekday = makeLocalDate(dateISO, "00:00").getDay();
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

/**
 * POST /booking/create
 * Body: { activityId, startISO, durationSlots, customerName, email, phone, paymentMethod }
 *
 * paymentMethod: "onsite" | "online"
 * paymentStatus sätts automatiskt:
 *  - onsite => unpaid
 *  - online => paid (sen kan du koppla Stripe osv)
 */
const createBooking = async (req, res) => {
  try {
    const {
      activityId,
      startISO,
      durationSlots,
      customerName,
      email,
      phone,
      paymentMethod,
      partySize,
    } = req.body;

    if (!activityId)
      return res.status(400).json({ message: "activityId is required" });
    if (!startISO)
      return res.status(400).json({ message: "startISO is required" });
    if (!durationSlots)
      return res.status(400).json({ message: "durationSlots is required" });

    if (!customerName?.trim())
      return res.status(400).json({ message: "customerName is required" });
    if (!email?.trim())
      return res.status(400).json({ message: "email is required" });
    if (!phone?.trim())
      return res.status(400).json({ message: "phone is required" });

    if (!["onsite", "online"].includes(paymentMethod))
      return res
        .status(400)
        .json({ message: "paymentMethod must be onsite|online" });

    const act = await Activity.findById(activityId).select(
      "workshopId bookingRules pricingRules tracks bookingUnit partyRules takesPayment",
    );

    if (!act) return res.status(400).json({ message: "Invalid activityId" });

    const ws = await mongoose
      .model("Workshop")
      .findById(act.workshopId)
      .select("paymentOptions");

    const payOpts = ws?.paymentOptions || {
      allowOnsite: true,
      allowOnline: true,
    };

    if (paymentMethod === "onsite" && payOpts.allowOnsite === false) {
      return res
        .status(400)
        .json({ message: "Betala på plats är inte tillåtet" });
    }

    if (paymentMethod === "online" && payOpts.allowOnline === false) {
      return res
        .status(400)
        .json({ message: "Betala online är inte tillåtet" });
    }

    const slotMinutes = act.bookingRules?.slotMinutes || 60;
    const slots = Number(durationSlots);
    if (![1, 2].includes(slots))
      return res.status(400).json({ message: "durationSlots must be 1 or 2" });

    const startAt = new Date(startISO);
    if (Number.isNaN(startAt.getTime()))
      return res.status(400).json({ message: "startISO invalid date" });

    const endAt = new Date(startAt.getTime() + slots * slotMinutes * 60_000);

    const ps = Math.max(1, Number(partySize || 1));

    // Om aktiviteten är per_person: enforce min/max
    if (act.bookingUnit === "per_person") {
      const minP = Number(act.partyRules?.min ?? 1);
      const maxP = Number(act.partyRules?.max ?? 99);

      if (ps < minP || ps > maxP) {
        return res.status(400).json({
          message: `partySize must be between ${minP} and ${maxP}`,
        });
      }
    }

    const unitsNeeded = 1;

    const overlapping = await Booking.find({
      activityId: act._id,
      status: "active",
      startAt: { $lt: endAt },
      endAt: { $gt: startAt },
    }).select("partySize");

    const unitsTaken = overlapping.length;

    const capacity = Number(act.tracks || 0);

    if (unitsTaken + unitsNeeded > capacity) {
      return res.status(409).json({
        message: "Den tiden har inte tillräcklig kapacitet kvar",
      });
    }

    const currency = act.pricingRules?.currency || "SEK";
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

      const slotPrice =
        Math.round(pricePerHour * (slotMinutes / 60) * 100) / 100;
      unitPrices.push(slotPrice);
    }

    const baseTotal =
      Math.round(unitPrices.reduce((a, b) => a + b, 0) * 100) / 100;

    let totalPrice = baseTotal;

    // per person => multiplicera med sällskapets storlek
    if (act.bookingUnit === "per_person") {
      totalPrice = Math.round(baseTotal * ps * 100) / 100;
    }

    // gratis aktivitet => alltid 0 kr
    const isPaid = act.takesPayment !== false;
    if (!isPaid) {
      totalPrice = 0;
    }

    // TODO: här kan du stoppa in din “capacity check” (tracks) om du vill låsa på serversidan
    // Just nu: vi skapar bokningen rakt av.

    const doc = await Booking.create({
      workshopId: act.workshopId,
      activityId: act._id,

      customerName: customerName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),

      startAt,
      endAt,
      durationSlots: slots,

      bookingUnit: act.bookingUnit || "per_lane",
      partySize: ps,

      paymentMethod: isPaid ? paymentMethod : "onsite",
      paymentStatus: isPaid
        ? paymentMethod === "online"
          ? "paid"
          : "unpaid"
        : "paid",

      currency: act.pricingRules?.currency || "SEK",
      unitPrices: isPaid ? unitPrices : [],
      totalPrice,
    });

    return res.status(201).json({ ok: true, booking: doc });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};

/**
 * GET /booking/workshop/:workshopId?from=YYYY-MM-DD&to=YYYY-MM-DD
 * to = inclusive-ish i UI, men vi gör "to 23:59" i query för enkelhet
 */
const listBookingsForWorkshop = async (req, res) => {
  try {
    const { workshopId } = req.params;
    const { from, to } = req.query;

    if (!workshopId)
      return res.status(400).json({ message: "workshopId is required" });
    if (!isValidDateISO(from) || !isValidDateISO(to)) {
      return res.status(400).json({ message: "from/to must be YYYY-MM-DD" });
    }

    const fromStart = makeLocalDate(from, "00:00");
    const toEnd = makeLocalDate(to, "23:59");

    const wsId = new mongoose.Types.ObjectId(workshopId);

    const rows = await Booking.aggregate([
      {
        $match: {
          workshopId: wsId,
          status: "active",
          startAt: { $lte: toEnd },
          endAt: { $gte: fromStart },
        },
      },

      // join activity title
      {
        $lookup: {
          from: "activities",
          localField: "activityId",
          foreignField: "_id",
          as: "activity",
        },
      },
      { $unwind: { path: "$activity", preserveNullAndEmptyArrays: true } },

      {
        $addFields: {
          customerNameNorm: { $trim: { input: "$customerName" } },
          emailNorm: { $toLower: { $trim: { input: "$email" } } },
          phoneNorm: { $trim: { input: "$phone" } },

          // ✅ NYTT: normalisera partySize
          partySizeNorm: { $ifNull: ["$partySize", 1] },

          // gör att tider matchar även om ms skiljer
          startAtNorm: { $dateTrunc: { date: "$startAt", unit: "minute" } },
          endAtNorm: { $dateTrunc: { date: "$endAt", unit: "minute" } },
        },
      },
      // group "identiska" bokningar till en rad med quantity
      {
        $group: {
          _id: {
            customerName: "$customerNameNorm",
            email: "$emailNorm",
            phone: "$phoneNorm",

            activityId: "$activityId",
            activityTitle: "$activity.title",

            startAt: "$startAtNorm",
            endAt: "$endAtNorm",

            // ✅ NYTT: gör att bokningar med olika antal personer inte slås ihop
            partySize: "$partySizeNorm",

            durationSlots: "$durationSlots",
            paymentStatus: "$paymentStatus",
            paymentMethod: "$paymentMethod",
            status: "$status",
          },

          quantity: { $sum: 1 },
          createdAtMin: { $min: "$createdAt" },

          totalPriceSum: { $sum: "$totalPrice" },
          currencyFirst: { $first: "$currency" },

          bookingIds: { $push: "$_id" },
        },
      },

      // shape
      {
        $project: {
          _id: 0,
          id: {
            $concat: [
              { $toString: "$_id.activityId" },
              "_",
              { $toString: "$_id.startAt" },
              "_",
              { $toString: "$createdAtMin" },
            ],
          },
          customerName: "$_id.customerName",
          email: "$_id.email",
          phone: "$_id.phone",
          activityId: "$_id.activityId",
          activityTitle: { $ifNull: ["$_id.activityTitle", "Aktivitet"] },
          startAt: "$_id.startAt",
          endAt: "$_id.endAt",
          partySize: "$_id.partySize",
          durationSlots: "$_id.durationSlots",
          paymentStatus: "$_id.paymentStatus",
          paymentMethod: "$_id.paymentMethod",
          totalPrice: "$totalPriceSum",
          currency: "$currencyFirst",
          status: "$_id.status",
          quantity: 1,

          bookingIds: 1,
        },
      },

      { $sort: { startAt: 1 } },
    ]);

    return res.json({ ok: true, bookings: rows });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};

const cancelBookings = async (req, res) => {
  try {
    const { bookingIds } = req.body;

    if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
      return res.status(400).json({ ok: false, message: "bookingIds krävs" });
    }

    const ids = bookingIds.map((id) => new mongoose.Types.ObjectId(id));

    const result = await Booking.updateMany(
      { _id: { $in: ids } },
      { $set: { status: "cancelled" } },
    );

    return res.json({ ok: true, modified: result.modifiedCount });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};

// --------------------
// PATCH /booking/mark-paid
// Body: { bookingIds: [ObjectId] }
// Markerar bokningar som betalda (t.ex. "betald på plats")
// --------------------
const markBookingsPaid = async (req, res) => {
  try {
    const { bookingIds } = req.body;

    if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
      return res.status(400).json({ ok: false, message: "bookingIds krävs" });
    }

    const ids = bookingIds.map((id) => new mongoose.Types.ObjectId(id));

    // Markera bara aktiva bokningar som betalda
    const result = await Booking.updateMany(
      { _id: { $in: ids }, status: "active" },
      { $set: { paymentStatus: "paid" } },
    );

    return res.json({ ok: true, modified: result.modifiedCount });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};

module.exports = {
  createBooking,
  listBookingsForWorkshop,
  cancelBookings,
  markBookingsPaid,
};
