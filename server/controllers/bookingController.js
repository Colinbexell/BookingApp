const Booking = require("../models/bookingModel");
const Activity = require("../models/activityModel");

// POST /booking/create
// Body: { activityId, startISO, durationSlots, customerName, customerEmail, customerPhone }
const createBooking = async (req, res) => {
  try {
    const {
      activityId,
      startISO,
      durationSlots,
      customerName,
      customerEmail,
      customerPhone,
    } = req.body;

    if (!activityId)
      return res
        .status(400)
        .json({ ok: false, message: "activityId is required" });
    if (!startISO)
      return res
        .status(400)
        .json({ ok: false, message: "startISO is required" });

    const dur = Number(durationSlots);
    if (![1, 2].includes(dur)) {
      return res
        .status(400)
        .json({ ok: false, message: "durationSlots must be 1 or 2" });
    }

    const act = await Activity.findById(activityId);
    if (!act)
      return res.status(404).json({ ok: false, message: "Activity not found" });

    const slotMinutes = act.bookingRules?.slotMinutes || 60;

    const startAt = new Date(startISO);
    if (Number.isNaN(startAt.getTime())) {
      return res
        .status(400)
        .json({ ok: false, message: "startISO is invalid" });
    }

    const endAt = new Date(startAt.getTime() + dur * slotMinutes * 60_000);

    // Capacity check (atomisk nog för MVP, men nästa steg är transaction/lock)
    const taken = await Booking.countDocuments({
      activityId: act._id,
      status: "active",
      startAt: { $lt: endAt },
      endAt: { $gt: startAt },
    });

    if (taken >= act.tracks) {
      return res
        .status(409)
        .json({ ok: false, message: "Slot is fully booked" });
    }

    const booking = await Booking.create({
      activityId: act._id,
      workshopId: act.workshopId,
      startAt,
      endAt,
      durationSlots: dur,
      slotMinutes,
      customerName,
      customerEmail,
      customerPhone,
    });

    return res.status(201).json({ ok: true, booking });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};

// GET /booking/activity/:activityId?from=YYYY-MM-DD&to=YYYY-MM-DD
const listBookingsForActivity = async (req, res) => {
  try {
    const { activityId } = req.params;
    const { from, to } = req.query;

    const start = from ? new Date(`${from}T00:00:00`) : null;
    const end = to ? new Date(`${to}T00:00:00`) : null;

    const q = { activityId, status: "active" };
    if (start && end) {
      q.startAt = { $lt: end };
      q.endAt = { $gt: start };
    }

    const bookings = await Booking.find(q).sort({ startAt: 1 });
    return res.json({ ok: true, bookings });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};

// GET /booking/workshop/:workshopId?from=YYYY-MM-DD&to=YYYY-MM-DD
const listBookingsForWorkshop = async (req, res) => {
  try {
    const { workshopId } = req.params;
    const { from, to } = req.query;

    const start = from ? new Date(`${from}T00:00:00`) : null;
    const end = to ? new Date(`${to}T00:00:00`) : null;

    const q = { workshopId, status: "active" };
    if (start && end) {
      q.startAt = { $lt: end };
      q.endAt = { $gt: start };
    }

    const bookings = await Booking.find(q)
      .populate("activityId", "title")
      .sort({ startAt: 1 });

    return res.json({ ok: true, bookings });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};

module.exports = {
  createBooking,
  listBookingsForActivity,
  listBookingsForWorkshop,
};
