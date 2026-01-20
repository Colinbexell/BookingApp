const Workshop = require("../models/workshopModel");

/**
 * POST /api/workshops
 * Body: { name, companyId }
 */
const createWorkshop = async (req, res) => {
  try {
    const { name, companyId } = req.body;

    if (!name) return res.status(400).json({ message: "Name is required" });
    if (!companyId)
      return res.status(400).json({ message: "Company ID is required" });

    // availability finns default i modellen, så vi behöver inte skicka in den här
    const newWorkshop = await Workshop.create({ name, companyId });
    return res.status(201).json(newWorkshop);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/workshops/:id/name
 */
const getWorkshopName = async (req, res) => {
  const { id } = req.params;
  try {
    const workshop = await Workshop.findById(id);
    if (!workshop)
      return res.status(404).json({ message: "Workshop not found" });
    return res.json({ name: workshop.name });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/workshops/:id/availability
 */
const getWorkshopAvailability = async (req, res) => {
  const { id } = req.params;
  try {
    const workshop = await Workshop.findById(id).select("availability");

    if (!workshop)
      return res.status(404).json({ message: "Workshop not found" });

    return res.json({ ok: true, availability: workshop.availability });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};

// --- hjälpfunktioner för basic validering ---
const isValidHHMM = (s) =>
  typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const isValidDateISO = (s) =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/**
 * PATCH /api/workshops/:id/availability
 * Body: { weekly: [{day,open,close}], exceptions: [{date,closed,open,close,reason}] }
 */
const updateWorkshopAvailability = async (req, res) => {
  const { id } = req.params;
  try {
    const { weekly, exceptions } = req.body;

    const workshop = await Workshop.findById(id);
    if (!workshop)
      return res.status(404).json({ message: "Workshop not found" });

    // ✅ basic validering (räcker för MVP men stoppar uppenbara fel)
    if (weekly && !Array.isArray(weekly)) {
      return res.status(400).json({ message: "weekly must be an array" });
    }
    if (exceptions && !Array.isArray(exceptions)) {
      return res.status(400).json({ message: "exceptions must be an array" });
    }

    if (Array.isArray(weekly)) {
      for (const w of weekly) {
        if (typeof w.day !== "number" || w.day < 0 || w.day > 6) {
          return res.status(400).json({ message: "weekly.day must be 0..6" });
        }
        if (!isValidHHMM(w.open) || !isValidHHMM(w.close)) {
          return res
            .status(400)
            .json({ message: "weekly.open/close must be HH:MM" });
        }
      }
    }

    if (Array.isArray(exceptions)) {
      for (const e of exceptions) {
        if (!isValidDateISO(e.date)) {
          return res
            .status(400)
            .json({ message: "exceptions.date must be YYYY-MM-DD" });
        }
        if (e.closed === true) continue; // stängt = ok, inga tider krävs
        // specialöppet: open+close måste finnas och vara HH:MM
        if (
          (e.open || e.close) &&
          (!isValidHHMM(e.open) || !isValidHHMM(e.close))
        ) {
          return res.status(400).json({
            message: "exceptions.open/close must be HH:MM when provided",
          });
        }
      }
    }

    // ✅ uppdatera
    workshop.availability = {
      weekly: Array.isArray(weekly) ? weekly : workshop.availability.weekly,
      exceptions: Array.isArray(exceptions)
        ? exceptions
        : workshop.availability.exceptions,
    };

    await workshop.save();

    return res.json({ ok: true, availability: workshop.availability });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};

/**
 * GET /api/workshop/:id/settings
 * return: { paymentOptions }
 */
const getWorkshopSettings = async (req, res) => {
  const { id } = req.params;
  try {
    const workshop = await Workshop.findById(id).select("paymentOptions");
    if (!workshop)
      return res.status(404).json({ message: "Workshop not found" });

    return res.json({
      ok: true,
      paymentOptions: workshop.paymentOptions || {
        allowOnsite: true,
        allowOnline: true,
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};

/**
 * PATCH /api/workshop/:id/settings
 * body: { paymentOptions: { allowOnsite, allowOnline } }
 */
const updateWorkshopSettings = async (req, res) => {
  const { id } = req.params;

  try {
    const { paymentOptions } = req.body;

    const workshop = await Workshop.findById(id);
    if (!workshop)
      return res.status(404).json({ message: "Workshop not found" });

    const allowOnsite =
      paymentOptions?.allowOnsite === undefined
        ? (workshop.paymentOptions?.allowOnsite ?? true)
        : !!paymentOptions.allowOnsite;

    const allowOnline =
      paymentOptions?.allowOnline === undefined
        ? (workshop.paymentOptions?.allowOnline ?? true)
        : !!paymentOptions.allowOnline;

    // Stoppa att båda blir false (annars kan ingen betala)
    if (!allowOnsite && !allowOnline) {
      return res.status(400).json({
        message: "Minst ett betalsätt måste vara aktivt",
      });
    }

    workshop.paymentOptions = { allowOnsite, allowOnline };
    await workshop.save();

    return res.json({ ok: true, paymentOptions: workshop.paymentOptions });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};

module.exports = {
  createWorkshop,
  getWorkshopName,
  getWorkshopAvailability,
  updateWorkshopAvailability,
  getWorkshopSettings,
  updateWorkshopSettings,
};
