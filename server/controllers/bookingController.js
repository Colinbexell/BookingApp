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
      "workshopId bookingRules"
    );
    if (!act) return res.status(400).json({ message: "Invalid activityId" });

    const slotMinutes = act.bookingRules?.slotMinutes || 60;
    const slots = Number(durationSlots);
    if (![1, 2].includes(slots))
      return res.status(400).json({ message: "durationSlots must be 1 or 2" });

    const startAt = new Date(startISO);
    if (Number.isNaN(startAt.getTime()))
      return res.status(400).json({ message: "startISO invalid date" });

    const endAt = new Date(startAt.getTime() + slots * slotMinutes * 60_000);

    // TODO: här kan du stoppa in din “capacity check” (tracks) om du vill låsa på serversidan
    // Just nu: vi skapar bokningen rakt av.

    const doc = await Booking.create({
      workshopId: act.workshopId,
      activityId: act._id,

      customerName,
      email,
      phone,

      startAt,
      endAt,
      durationSlots: slots,

      paymentMethod,
      paymentStatus: paymentMethod === "online" ? "paid" : "unpaid",
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

      // group "identiska" bokningar till en rad med quantity
      {
        $group: {
          _id: {
            customerName: "$customerName",
            email: "$email",
            phone: "$phone",
            activityId: "$activityId",
            activityTitle: "$activity.title",
            startAt: "$startAt",
            endAt: "$endAt",
            durationSlots: "$durationSlots",
            paymentStatus: "$paymentStatus",
            paymentMethod: "$paymentMethod",
            status: "$status",
          },
          quantity: { $sum: 1 },
          createdAtMin: { $min: "$createdAt" },
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
          durationSlots: "$_id.durationSlots",
          paymentStatus: "$_id.paymentStatus",
          paymentMethod: "$_id.paymentMethod",
          status: "$_id.status",
          quantity: 1,
        },
      },

      { $sort: { startAt: 1 } },
    ]);

    return res.json({ ok: true, bookings: rows });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};

module.exports = {
  createBooking,
  listBookingsForWorkshop,
};
