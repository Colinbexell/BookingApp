const Activity = require("../models/activityModel");
const Workshop = require("../models/workshopModel");
const Booking = require("../models/bookingModel");

// ---- validators ----
const isValidHHMM = (s) =>
  typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const isValidDateISO = (s) =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

// ---- time helpers (Sverige-only) ----
const pad2 = (n) => String(n).padStart(2, "0");
const toISODate = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const hhmmToMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const minutesToHHMM = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${pad2(h)}:${pad2(m)}`;
};

const makeLocalDate = (dateISO, hhmm) => {
  const [y, mo, da] = dateISO.split("-").map(Number);
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(y, mo - 1, da, h, m, 0, 0);
};

const addMinutes = (date, mins) => new Date(date.getTime() + mins * 60_000);

const listDates = (fromISO, toISOExclusive) => {
  const dates = [];
  const from = makeLocalDate(fromISO, "00:00");
  const to = makeLocalDate(toISOExclusive, "00:00");
  for (let d = new Date(from.getTime()); d < to; d.setDate(d.getDate() + 1)) {
    dates.push(toISODate(d));
  }
  return dates;
};

const resolveAvailability = async (activityDoc) => {
  if (!activityDoc.useWorkshopAvailability)
    return activityDoc.availability || { weekly: [], exceptions: [] };

  const ws = await Workshop.findById(activityDoc.workshopId).select(
    "availability"
  );
  return ws?.availability || { weekly: [], exceptions: [] };
};

const generateDaySlots = ({ dateISO, availability, slotMinutes }) => {
  const weekday = makeLocalDate(dateISO, "00:00").getDay(); // 0=sön..6=lör
  const ex = (availability.exceptions || []).find((e) => e.date === dateISO);

  if (ex?.closed === true) return [];

  let open = null;
  let close = null;

  if (ex?.open && ex?.close) {
    open = ex.open;
    close = ex.close;
  } else {
    const w = (availability.weekly || []).find((x) => x.day === weekday);
    if (!w) return [];
    open = w.open;
    close = w.close;
  }

  if (!isValidHHMM(open) || !isValidHHMM(close)) return [];

  const openMin = hhmmToMinutes(open);
  const closeMin = hhmmToMinutes(close);
  if (closeMin <= openMin) return [];

  const slots = [];
  for (let t = openMin; t + slotMinutes <= closeMin; t += slotMinutes) {
    const startHHMM = minutesToHHMM(t);
    const endHHMM = minutesToHHMM(t + slotMinutes);

    const startLocal = makeLocalDate(dateISO, startHHMM);
    const endLocal = makeLocalDate(dateISO, endHHMM);

    slots.push({
      dateISO,
      startISO: startLocal.toISOString(),
      endISO: endLocal.toISOString(),
    });
  }
  return slots;
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
    if (!isValidHHMM(r.start) || !isValidHHMM(r.end)) continue;
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

// --------------------
// POST /activity/create
// Body: { title, information, imageUrl, tracks, workshopId, bookingRules, useWorkshopAvailability, availability }
// --------------------
const createActivity = async (req, res) => {
  try {
    const {
      title,
      information,
      imageUrl,
      tracks,
      workshopId,
      bookingRules,
      pricingRules,
      useWorkshopAvailability,
      availability,
      takesPayment,
      bookingUnit,
      partyRules,
    } = req.body;

    if (!title) return res.status(400).json({ message: "title is required" });
    if (!information)
      return res.status(400).json({ message: "information is required" });
    if (!imageUrl)
      return res.status(400).json({ message: "imageUrl is required" });
    if (!tracks) return res.status(400).json({ message: "tracks is required" });
    if (!workshopId)
      return res.status(400).json({ message: "workshopId is required" });

    const unit = bookingUnit || "per_lane";
    if (!["per_lane", "per_person"].includes(unit)) {
      return res.status(400).json({
        message: "bookingUnit must be per_lane|per_person",
      });
    }

    const prMin = Number(partyRules?.min ?? 1);
    const prMax = Number(partyRules?.max ?? 99);

    if (prMin < 1 || prMax < 1 || prMin > prMax) {
      return res.status(400).json({
        message: "partyRules invalid (min>=1, max>=1, min<=max)",
      });
    }

    const ws = await Workshop.findById(workshopId).select("_id");
    if (!ws) {
      return res
        .status(400)
        .json({ message: "Invalid workshopId (workshop not found)" });
    }

    const doc = await Activity.create({
      title,
      information,
      imageUrl,
      tracks: Number(tracks),
      takesPayment: takesPayment !== false && takesPayment !== "false",
      bookingUnit: unit,
      partyRules: { min: prMin, max: prMax },
      workshopId,
      bookingRules: bookingRules || undefined,
      pricingRules: pricingRules || undefined,
      useWorkshopAvailability:
        useWorkshopAvailability !== false &&
        useWorkshopAvailability !== "false",
      availability:
        useWorkshopAvailability === false || useWorkshopAvailability === "false"
          ? availability
          : undefined,
    });

    return res.status(201).json({ ok: true, activity: doc });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};

// --------------------
// PATCH /activity/:id
// Body: valfria fält som ska uppdateras
// --------------------
const updateActivity = async (req, res) => {
  try {
    const { id } = req.params;

    const patch = { ...req.body };

    // säkerställ att tracks/slotMinutes osv blir nummer om de kommer som string
    if (patch.tracks !== undefined) patch.tracks = Number(patch.tracks);
    if (patch.bookingRules?.slotMinutes !== undefined)
      patch.bookingRules.slotMinutes = Number(patch.bookingRules.slotMinutes);
    if (patch.bookingRules?.minSlots !== undefined)
      patch.bookingRules.minSlots = Number(patch.bookingRules.minSlots);
    if (patch.bookingRules?.maxSlots !== undefined)
      patch.bookingRules.maxSlots = Number(patch.bookingRules.maxSlots);

    if (patch.pricingRules?.defaultPricePerHour !== undefined)
      patch.pricingRules.defaultPricePerHour = Number(
        patch.pricingRules.defaultPricePerHour
      );

    const updated = await Activity.findByIdAndUpdate(id, patch, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ ok: false, message: "Activity not found" });
    }

    return res.json({ ok: true, activity: updated });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};

// --------------------
// DELETE /activity/:id
// --------------------
const deleteActivity = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Activity.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ ok: false, message: "Activity not found" });
    }

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};

// --------------------
// GET /activity
// Query: ?workshopId=...
// --------------------
const listActivities = async (req, res) => {
  try {
    const { workshopId } = req.query;

    const q = workshopId ? { workshopId } : {};
    const acts = await Activity.find(q).sort({ createdAt: -1 });

    // frontend vill ofta ha id istället för _id
    const activities = acts.map((a) => ({
      id: a._id,
      title: a.title,
      information: a.information,
      imageUrl: a.imageUrl,
      tracks: a.tracks,

      takesPayment: a.takesPayment,
      bookingUnit: a.bookingUnit,
      partyRules: a.partyRules,

      bookingRules: a.bookingRules,
      pricingRules: a.pricingRules,
      useWorkshopAvailability: a.useWorkshopAvailability,
      workshopId: a.workshopId,
    }));

    return res.json({ ok: true, activities });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};

// --------------------
// GET /activity/:id
// --------------------
const getActivity = async (req, res) => {
  try {
    const act = await Activity.findById(req.params.id);
    if (!act)
      return res.status(404).json({ ok: false, message: "Activity not found" });
    return res.json({ ok: true, activity: act });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};

// --------------------
// GET /activity/:id/availability?from=YYYY-MM-DD&to=YYYY-MM-DD
// to = EXCLUSIVE (bra standard)
// return: slots med isAvailable + availableTracks
// --------------------
const getActivityAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { from, to } = req.query;

    if (!isValidDateISO(from) || !isValidDateISO(to)) {
      return res
        .status(400)
        .json({ ok: false, message: "from/to must be YYYY-MM-DD" });
    }

    const act = await Activity.findById(id);
    if (!act) {
      return res.status(404).json({ ok: false, message: "Activity not found" });
    }

    const slotMinutes = act.bookingRules?.slotMinutes || 60;
    const minSlots = act.bookingRules?.minSlots || 1;
    const maxSlots = act.bookingRules?.maxSlots || 2;

    const availability = await resolveAvailability(act);

    const fromStart = makeLocalDate(from, "00:00");
    const toStart = makeLocalDate(to, "00:00");

    const bookings = await Booking.find({
      activityId: act._id,
      status: "active",
      startAt: { $lt: toStart },
      endAt: { $gt: fromStart },
    }).select("startAt endAt partySize");

    const now = new Date();
    const leadMinutes = 0; // ändra till t.ex. 10 om du vill ha framförhållning
    const minAllowedStart = new Date(now.getTime() + leadMinutes * 60_000);

    const dates = listDates(from, to);
    const slots = [];

    for (const dateISO of dates) {
      const daySlots = generateDaySlots({ dateISO, availability, slotMinutes });

      for (const s of daySlots) {
        const slotStart = new Date(s.startISO);
        const slotEnd = new Date(s.endISO);

        const todayISO = toISODate(new Date());
        if (dateISO === todayISO && slotStart <= minAllowedStart) continue;

        const taken = bookings.reduce((acc, b) => {
          const ov = b.startAt < slotEnd && slotStart < b.endAt;
          if (!ov) return acc;

          // per_lane: 1 per bokning
          // per_person: partySize per bokning
          const inc = 1;

          return acc + inc;
        }, 0);

        const availableTracks = Math.max(0, act.tracks - taken);

        const startLocal = new Date(s.startISO);
        const startHHMM = startLocal.toLocaleTimeString("sv-SE", {
          hour: "2-digit",
          minute: "2-digit",
        });

        const { pricePerHour, currency } = getPriceForSlot({
          pricingRules: act.pricingRules,
          dateISO,
          startHHMM,
        });

        const slotPrice =
          Math.round(pricePerHour * (slotMinutes / 60) * 100) / 100;

        slots.push({
          dateISO,
          startISO: s.startISO,
          endISO: s.endISO,
          availableTracks,
          isAvailable: availableTracks > 0,
          pricePerHour,
          slotPrice,
          currency,
        });
      }
    }

    return res.json({
      ok: true,
      slotMinutes,
      minSlots,
      maxSlots,
      tracks: act.tracks,
      slots,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};

module.exports = {
  createActivity,
  listActivities,
  getActivity,
  getActivityAvailability,
  updateActivity,
  deleteActivity,
};
