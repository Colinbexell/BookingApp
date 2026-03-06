const mongoose = require("mongoose");
const Booking = require("../models/bookingModel");
const BookingArchive = require("../models/bookingArchiveModel");
const Activity = require("../models/activityModel");
const Workshop = require("../models/workshopModel");

const isValidDateISO = (s) =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

const makeLocalDate = (dateISO, hhmm) => {
  const [y, mo, da] = dateISO.split("-").map(Number);
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(y, mo - 1, da, h, m, 0, 0);
};

const addDaysISO = (isoDate, days) => {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const pad2 = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
};

const startOfLocalDay = (iso) => makeLocalDate(iso, "00:00");
const endOfLocalDay   = (iso) => makeLocalDate(iso, "23:59");

const toISODateLocal = (d) => {
  const pad2 = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

// ─── Status-helpers ───────────────────────────────────────────────────────────
// "active" finns i enum men sätts aldrig i koden – behandla det som confirmed
// för att inte tappa eventuell legacy-data.
const CONFIRMED_STATUSES = ["confirmed", "active"];
const isConfirmed  = (b) => CONFIRMED_STATUSES.includes(b.status);
const isPending    = (b) => b.status === "pending";
const isCancelled  = (b) => b.status === "cancelled";

// ─── Archiver ─────────────────────────────────────────────────────────────────
const archiveOlderThanDays = async ({ workshopId, days = 21 }) => {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const query = {
    workshopId: new mongoose.Types.ObjectId(workshopId),
    endAt: { $lt: cutoff },
  };

  const docs = await Booking.find(query).lean();
  if (!docs.length) return { moved: 0 };

  const archivedDocs = docs.map((b) => ({
    ...b,
    _id: undefined,
    archivedAt: new Date(),
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  }));

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await BookingArchive.insertMany(archivedDocs, { session });
    await Booking.deleteMany(
      { _id: { $in: docs.map((d) => d._id) } },
      { session },
    );
    await session.commitTransaction();
    session.endSession();
    return { moved: docs.length };
  } catch (e) {
    await session.abortTransaction();
    session.endSession();
    throw e;
  }
};

// ─── Bucket-helper för tidsserier ─────────────────────────────────────────────
const makeBucketKey = (date, groupBy) => {
  const d = new Date(date);
  if (groupBy === "day") return toISODateLocal(d);
  if (groupBy === "week") {
    const copy = new Date(d.getTime());
    const day  = (copy.getDay() + 6) % 7; // 0 = mån
    copy.setDate(copy.getDate() - day);
    return toISODateLocal(copy);
  }
  if (groupBy === "month") {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }
  if (groupBy === "year") return `${d.getFullYear()}`;
  return toISODateLocal(d);
};

// ─── Main handler ─────────────────────────────────────────────────────────────
// GET /stats/workshop/:workshopId?from=YYYY-MM-DD&to=YYYY-MM-DD&groupBy=day|week|month|year
const getWorkshopStats = async (req, res) => {
  try {
    const { workshopId } = req.params;
    const { from, to, groupBy = "day" } = req.query;

    if (!workshopId)
      return res.status(400).json({ message: "workshopId is required" });
    if (!isValidDateISO(from) || !isValidDateISO(to))
      return res.status(400).json({ message: "from/to must be YYYY-MM-DD" });
    if (!["day", "week", "month", "year"].includes(groupBy))
      return res.status(400).json({ message: "groupBy must be day|week|month|year" });

    // 1) Arkivera gamla bokningar innan vi räknar
    const archiveResult = await archiveOlderThanDays({ workshopId, days: 21 });

    const wsId      = new mongoose.Types.ObjectId(workshopId);
    const fromStart = startOfLocalDay(from);
    const toEnd     = endOfLocalDay(to);

    // 2) Hämta aktiviteter (för titlar, banor, etc.)
    const activities = await Activity.find({ workshopId: wsId })
      .select("_id title tracks bookingRules takesPayment bookingUnit")
      .lean();

    const actMap = new Map(activities.map((a) => [String(a._id), a]));

    // 3) Hämta live + arkiverade bokningar för perioden
    const baseMatch = {
      workshopId: wsId,
      startAt: { $lte: toEnd },
      endAt:   { $gte: fromStart },
    };

    const [live, archived] = await Promise.all([
      Booking.find(baseMatch).lean(),
      BookingArchive.find(baseMatch).lean(),
    ]);

    const all = [...live, ...archived];

    // ── Segmentera ──────────────────────────────────────────────────────────
    const confirmedBookings = all.filter(isConfirmed);
    const pendingBookings   = all.filter(isPending);
    const cancelledBookings = all.filter(isCancelled);

    // ─── 4) KPIs ────────────────────────────────────────────────────────────

    // Bekräftade (verkliga) bokningar
    const totalConfirmed     = confirmedBookings.length;
    // Väntande: skapade men ej e-postbekräftade (token ej klickad ännu)
    const totalPending       = pendingBookings.length;
    // Avbokade
    const totalCancellations = cancelledBookings.length;

    // Avbokningsgrad = avbokade / (bekräftade + avbokade)
    const cancellationRate =
      totalConfirmed + totalCancellations === 0
        ? 0
        : (totalCancellations / (totalConfirmed + totalCancellations)) * 100;

    // Preliminär omsättning = mail-bekräftade bokningar (kunden svarat), oavsett betalning.
    // Obesvarade mail (pending) räknas INTE.
    const preliminaryRevenue = confirmedBookings
      .reduce((sum, b) => sum + Number(b.totalPrice || 0), 0);

    // Faktisk omsättning = alla bokningar där betalningen är bekräftad (paymentStatus: "paid"),
    // oavsett om mailet är besvarat eller ej — pending + confirmed räknas båda.
    const actualRevenue = all
      .filter((b) => !isCancelled(b) && b.paymentStatus === "paid")
      .reduce((sum, b) => sum + Number(b.totalPrice || 0), 0);

    // Potentiell omsättning = obesvarade mail (pending), försvinner om 24h-token går ut
    const pendingRevenue = pendingBookings
      .reduce((sum, b) => sum + Number(b.totalPrice || 0), 0);

    // Antal dagar i intervallet
    const dayCount = Math.max(
      1,
      Math.round(
        (endOfLocalDay(to).getTime() - startOfLocalDay(from).getTime()) /
          (24 * 60 * 60 * 1000),
      ) + 1,
    );

    // Snitt bekräftade bokningar per dag
    const avgBookingsPerDay = totalConfirmed / dayCount;

    // Lead time: snittet av (startAt - createdAt) i timmar, för bekräftade
    const leadTimes = confirmedBookings
      .filter((b) => b.createdAt && b.startAt)
      .map((b) =>
        (new Date(b.startAt).getTime() - new Date(b.createdAt).getTime()) / 36e5,
      )
      .filter((x) => Number.isFinite(x) && x >= 0);

    const avgLeadTimeHours = leadTimes.length
      ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length
      : 0;

    // Betalsätt-fördelning (bland bekräftade)
    const payOnsiteCount = confirmedBookings.filter(
      (b) => b.paymentMethod === "onsite"
    ).length;
    const payOnlineCount = confirmedBookings.filter(
      (b) => b.paymentMethod === "online"
    ).length;

    // Obetalda som passerat sin tid (bekräftade, ej betalda, endAt < nu)
    const now = new Date();
    const unpaidAttention = confirmedBookings.filter(
      (b) => b.paymentStatus === "unpaid" && new Date(b.endAt) < now,
    ).length;

    // ─── 5) Snitt sällskapsstorlek per aktivitet (bekräftade) ───────────────
    const partyByAct = new Map();
    for (const b of confirmedBookings) {
      const id = String(b.activityId || "");
      if (!id) continue;
      const prev = partyByAct.get(id) || { sum: 0, n: 0 };
      prev.sum += Number(b.partySize || 1);
      prev.n   += 1;
      partyByAct.set(id, prev);
    }
    const avgPartySizePerActivity = Array.from(partyByAct.entries()).map(
      ([activityId, v]) => ({
        activityId,
        activityTitle: actMap.get(activityId)?.title || "Aktivitet",
        avgPartySize: v.n ? v.sum / v.n : 0,
      }),
    );

    // ─── 6) Populäraste aktiviteter per antal bekräftade bokningar ──────────
    const countByAct = new Map();
    for (const b of confirmedBookings) {
      const id = String(b.activityId || "");
      if (!id) continue;
      countByAct.set(id, (countByAct.get(id) || 0) + 1);
    }
    const topActivitiesByBookings = Array.from(countByAct.entries())
      .map(([activityId, count]) => ({
        activityId,
        activityTitle: actMap.get(activityId)?.title || "Aktivitet",
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // ─── 7) Avbokningsgrad per aktivitet ────────────────────────────────────
    const cancByAct = new Map();
    const totByAct  = new Map();
    for (const b of all) {
      if (isPending(b)) continue; // räkna inte in obekräftade
      const id = String(b.activityId || "");
      if (!id) continue;
      totByAct.set(id, (totByAct.get(id) || 0) + 1);
      if (isCancelled(b)) cancByAct.set(id, (cancByAct.get(id) || 0) + 1);
    }
    const cancellationRatePerActivity = Array.from(totByAct.entries())
      .map(([activityId, total]) => {
        const canc = cancByAct.get(activityId) || 0;
        return {
          activityId,
          activityTitle: actMap.get(activityId)?.title || "Aktivitet",
          rate: total ? (canc / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 8);

    // ─── 8) Omsättning per aktivitet (prelim / faktisk) ─────────────────────
    // prelim = mail-bekräftade, faktisk = betalda oavsett mailstatus
    const revPreByAct = new Map();
    const revActByAct = new Map();
    for (const b of all) {
      const id = String(b.activityId || "");
      if (!id || isCancelled(b)) continue;
      if (isConfirmed(b)) {
        revPreByAct.set(id, (revPreByAct.get(id) || 0) + Number(b.totalPrice || 0));
      }
      if (b.paymentStatus === "paid") {
        revActByAct.set(id, (revActByAct.get(id) || 0) + Number(b.totalPrice || 0));
      }
    }

    const topActivitiesByPreRevenue = Array.from(revPreByAct.entries())
      .map(([activityId, revenue]) => ({
        activityId,
        activityTitle: actMap.get(activityId)?.title || "Aktivitet",
        revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    const topActivitiesByActualRevenue = Array.from(revActByAct.entries())
      .map(([activityId, revenue]) => ({
        activityId,
        activityTitle: actMap.get(activityId)?.title || "Aktivitet",
        revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    // ─── 9) Peak hours per aktivitet (bekräftade) ───────────────────────────
    const peakByActHour = new Map();
    for (const b of confirmedBookings) {
      const id = String(b.activityId || "");
      if (!id) continue;
      const h   = new Date(b.startAt).getHours();
      const key = `${id}__${h}`;
      peakByActHour.set(key, (peakByActHour.get(key) || 0) + 1);
    }

    const peakHoursPerActivity = activities.map((a) => {
      const hours = Array.from({ length: 24 }).map((_, hour) => ({
        hour,
        count: peakByActHour.get(`${String(a._id)}__${hour}`) || 0,
      }));
      return { activityId: String(a._id), activityTitle: a.title, hours };
    });

    // ─── 10) Bokningar per veckodag (bekräftade) ─────────────────────────────
    const weekdayCounts = Array.from({ length: 7 }).map((_, d) => ({
      weekday: d,
      count: 0,
    }));
    for (const b of confirmedBookings) {
      const wd = new Date(b.startAt).getDay();
      weekdayCounts[wd].count += 1;
    }

    // ─── 11) Tidsserie (bucket) ───────────────────────────────────────────────
    // Inkluderar bekräftade + avbokade + väntande separat
    const seriesMap = new Map();
    for (const b of all) {
      const key  = makeBucketKey(b.startAt, groupBy);
      const prev = seriesMap.get(key) || {
        key,
        confirmed: 0,
        pending: 0,
        cancellations: 0,
        preliminaryRevenue: 0,
        actualRevenue: 0,
        pendingRevenue: 0,
      };

      if (isCancelled(b)) {
        prev.cancellations += 1;
      } else if (isPending(b)) {
        prev.pending       += 1;
        prev.pendingRevenue += Number(b.totalPrice || 0);
        // betald trots obesvarat mail räknas som faktisk omsättning
        if (b.paymentStatus === "paid") prev.actualRevenue += Number(b.totalPrice || 0);
      } else if (isConfirmed(b)) {
        prev.confirmed          += 1;
        prev.preliminaryRevenue += Number(b.totalPrice || 0);
        if (b.paymentStatus === "paid") prev.actualRevenue += Number(b.totalPrice || 0);
      }

      seriesMap.set(key, prev);
    }

    const timeSeries = Array.from(seriesMap.values()).sort((a, b) =>
      a.key.localeCompare(b.key),
    );

    // ─── 12) Utnyttjad kapacitet (approximation) ─────────────────────────────
    // Baseras på bekräftade bokningar mot totalt antal tillgängliga resurser
    const bookedUnits  = totalConfirmed;
    const totalTracks  = activities
      .filter((a) => a.bookingUnit !== "per_staff") // personal räknas inte som "banor"
      .reduce((s, a) => s + Number(a.tracks || 0), 0);

    const approxSlotsPerDay    = 8;
    const capacityUnitsApprox  = totalTracks * dayCount * approxSlotsPerDay;
    const utilizationApproxPct =
      capacityUnitsApprox > 0 ? (bookedUnits / capacityUnitsApprox) * 100 : 0;

    // ─── 13) Framåtblick: mest bokade dagar kommande 7 dagar ─────────────────
    const todayISO  = toISODateLocal(new Date());
    const to7       = addDaysISO(todayISO, 7);
    const futureFrom = startOfLocalDay(todayISO);
    const futureTo   = endOfLocalDay(to7);

    const future = await Booking.find({
      workshopId: wsId,
      status: { $in: CONFIRMED_STATUSES }, // bara bekräftade framåt
      startAt: { $lte: futureTo },
      endAt:   { $gte: futureFrom },
    })
      .select("activityId startAt")
      .lean();

    const futureByDay = new Map();
    for (const b of future) {
      const dayKey = toISODateLocal(new Date(b.startAt));
      const actId  = String(b.activityId || "");
      const mapKey = `${dayKey}__${actId}`;
      futureByDay.set(mapKey, (futureByDay.get(mapKey) || 0) + 1);
    }

    const tmp = new Map();
    for (const [k, count] of futureByDay.entries()) {
      const [date, actId] = k.split("__");
      const prev = tmp.get(date) || { date, total: 0, activities: [] };
      prev.total += count;
      prev.activities.push({
        activityId: actId,
        activityTitle: actMap.get(actId)?.title || "Aktivitet",
        count,
      });
      tmp.set(date, prev);
    }
    const upcomingTopDays = Array.from(tmp.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 7);

    // ─── Svar ─────────────────────────────────────────────────────────────────
    return res.json({
      ok: true,
      meta: { archivedMovedNow: archiveResult.moved },

      kpis: {
        // Bekräftade (verkliga) bokningar
        totalBookings: totalConfirmed,
        // Väntande (skapade men ej e-postbekräftade)
        totalPending,
        // Avbokade
        totalCancellations,
        cancellationRate,

        // Omsättning
        preliminaryRevenue, // bekräftade, oavsett betalstatus
        actualRevenue,      // bekräftade + betalda
        pendingRevenue,     // potentiell omsättning från väntande

        // Övriga nyckeltal
        avgBookingsPerDay,
        avgLeadTimeHours,
        payOnsiteCount,
        payOnlineCount,
        unpaidAttention,

        // Kapacitet
        utilizationApproxPct,
        bookedUnits,
        capacityUnitsApprox,
      },

      charts: {
        timeSeries,
        topActivitiesByBookings,
        cancellationRatePerActivity,
        topActivitiesByPreRevenue,
        topActivitiesByActualRevenue,
        avgPartySizePerActivity,
        weekdayCounts,
        peakHoursPerActivity,
        upcomingTopDays,
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};

module.exports = { getWorkshopStats };