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
const endOfLocalDay = (iso) => makeLocalDate(iso, "23:59");

const toISODateLocal = (d) => {
  const pad2 = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

// --- archiver: flytta äldre än 21 dagar (baserat på endAt) ---
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

// --- helper: groupKey för period ---
const makeBucketKey = (date, groupBy) => {
  const d = new Date(date);
  if (groupBy === "day") {
    return toISODateLocal(d);
  }
  if (groupBy === "week") {
    // ISO-ish: måndag som start
    const copy = new Date(d.getTime());
    const day = (copy.getDay() + 6) % 7; // 0=mån..6=sön
    copy.setDate(copy.getDate() - day);
    return `${toISODateLocal(copy)}`;
  }
  if (groupBy === "month") {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }
  if (groupBy === "year") return `${d.getFullYear()}`;
  return toISODateLocal(d);
};

// --- GET /stats/workshop/:workshopId?from=YYYY-MM-DD&to=YYYY-MM-DD&groupBy=day|week|month|year
const getWorkshopStats = async (req, res) => {
  try {
    const { workshopId } = req.params;
    const { from, to, groupBy = "day" } = req.query;

    if (!workshopId)
      return res.status(400).json({ message: "workshopId is required" });
    if (!isValidDateISO(from) || !isValidDateISO(to)) {
      return res.status(400).json({ message: "from/to must be YYYY-MM-DD" });
    }
    if (!["day", "week", "month", "year"].includes(groupBy)) {
      return res
        .status(400)
        .json({ message: "groupBy must be day|week|month|year" });
    }

    // 1) arkivera innan vi räknar
    const archiveResult = await archiveOlderThanDays({ workshopId, days: 21 });

    const wsId = new mongoose.Types.ObjectId(workshopId);
    const fromStart = startOfLocalDay(from);
    const toEnd = endOfLocalDay(to);

    // 2) hämta aktiviteter för “tracks” och titlar
    const activities = await Activity.find({ workshopId: wsId })
      .select("_id title tracks bookingRules takesPayment")
      .lean();

    const actMap = new Map(activities.map((a) => [String(a._id), a]));

    // 3) hämta både live + archive för vald period
    const baseMatch = {
      workshopId: wsId,
      startAt: { $lte: toEnd },
      endAt: { $gte: fromStart },
    };

    const [live, archived] = await Promise.all([
      Booking.find(baseMatch).lean(),
      BookingArchive.find(baseMatch).lean(),
    ]);

    const all = [...live, ...archived];

    // 4) KPIs
    const totalBookings = all.filter((b) => b.status === "active").length;
    const totalCancellations = all.filter(
      (b) => b.status === "cancelled",
    ).length;

    const cancellationRate =
      totalBookings + totalCancellations === 0
        ? 0
        : (totalCancellations / (totalBookings + totalCancellations)) * 100;

    const preliminaryRevenue = all
      .filter((b) => b.status === "active")
      .reduce((sum, b) => sum + Number(b.totalPrice || 0), 0);

    const actualRevenue = all
      .filter((b) => b.status === "active" && b.paymentStatus === "paid")
      .reduce((sum, b) => sum + Number(b.totalPrice || 0), 0);

    // snitt bokningar per dag inom intervallet (baserat på antal dagar)
    const dayCount = Math.max(
      1,
      Math.round(
        (endOfLocalDay(to).getTime() - startOfLocalDay(from).getTime()) /
          (24 * 60 * 60 * 1000),
      ) + 1,
    );
    const avgBookingsPerDay = (totalBookings + totalCancellations) / dayCount;

    // lead time: createdAt -> startAt (i timmar)
    const leadTimes = all
      .filter((b) => b.createdAt && b.startAt)
      .map(
        (b) =>
          (new Date(b.startAt).getTime() - new Date(b.createdAt).getTime()) /
          36e5,
      )
      .filter((x) => Number.isFinite(x) && x >= 0);

    const avgLeadTimeHours = leadTimes.length
      ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length
      : 0;

    // 5) payment method counts
    const payOnsiteCount = all.filter(
      (b) => b.paymentMethod === "onsite",
    ).length;
    const payOnlineCount = all.filter(
      (b) => b.paymentMethod === "online",
    ).length;

    // unpaid “needs attention”: aktiv + unpaid + har passerat
    const now = new Date();
    const unpaidAttention = all.filter(
      (b) =>
        b.status === "active" &&
        b.paymentStatus === "unpaid" &&
        new Date(b.endAt) < now,
    ).length;

    // 6) snitt sällskap per aktivitet
    const partyByAct = new Map();
    for (const b of all) {
      const id = String(b.activityId || "");
      if (!id) continue;
      const prev = partyByAct.get(id) || { sum: 0, n: 0 };
      prev.sum += Number(b.partySize || 1);
      prev.n += 1;
      partyByAct.set(id, prev);
    }
    const avgPartySizePerActivity = Array.from(partyByAct.entries()).map(
      ([activityId, v]) => ({
        activityId,
        activityTitle: actMap.get(activityId)?.title || "Aktivitet",
        avgPartySize: v.n ? v.sum / v.n : 0,
      }),
    );

    // 7) populäraste aktiviteter (bokningar)
    const countByAct = new Map();
    for (const b of all) {
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

    // 8) avbokningsgrad per aktivitet
    const cancByAct = new Map();
    const totByAct = new Map();
    for (const b of all) {
      const id = String(b.activityId || "");
      if (!id) continue;
      totByAct.set(id, (totByAct.get(id) || 0) + 1);
      if (b.status === "cancelled") {
        cancByAct.set(id, (cancByAct.get(id) || 0) + 1);
      }
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

    // 9) omsättning per aktivitet (prelim/faktisk)
    const revPreByAct = new Map();
    const revActByAct = new Map();
    for (const b of all) {
      const id = String(b.activityId || "");
      if (!id) continue;
      if (b.status === "active") {
        revPreByAct.set(
          id,
          (revPreByAct.get(id) || 0) + Number(b.totalPrice || 0),
        );
        if (b.paymentStatus === "paid") {
          revActByAct.set(
            id,
            (revActByAct.get(id) || 0) + Number(b.totalPrice || 0),
          );
        }
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

    // 10) peak hours per aktivitet (startAt hour)
    const peakByActHour = new Map();
    for (const b of all) {
      const id = String(b.activityId || "");
      if (!id) continue;
      const h = new Date(b.startAt).getHours();
      const key = `${id}__${h}`;
      peakByActHour.set(key, (peakByActHour.get(key) || 0) + 1);
    }

    // packa till en struktur som är lätt i FE: [{activityId, activityTitle, hours:[{hour,count}]}]
    const peakHoursPerActivity = activities.map((a) => {
      const hours = Array.from({ length: 24 }).map((_, hour) => ({
        hour,
        count: peakByActHour.get(`${String(a._id)}__${hour}`) || 0,
      }));
      return { activityId: String(a._id), activityTitle: a.title, hours };
    });

    // 11) bokningar per veckodag (0=sön..6=lör)
    const weekdayCounts = Array.from({ length: 7 }).map((_, d) => ({
      weekday: d,
      count: 0,
    }));
    for (const b of all) {
      const wd = new Date(b.startAt).getDay();
      weekdayCounts[wd].count += 1;
    }

    // 12) tidsserie för “vald period” (bucket)
    const seriesMap = new Map();
    for (const b of all) {
      const key = makeBucketKey(b.startAt, groupBy);
      const prev = seriesMap.get(key) || {
        key,
        bookings: 0,
        cancellations: 0,
        preliminaryRevenue: 0,
        actualRevenue: 0,
      };

      if (b.status === "cancelled") prev.cancellations += 1;
      else prev.bookings += 1;

      if (b.status === "active") {
        prev.preliminaryRevenue += Number(b.totalPrice || 0);
        if (b.paymentStatus === "paid")
          prev.actualRevenue += Number(b.totalPrice || 0);
      }

      seriesMap.set(key, prev);
    }

    const timeSeries = Array.from(seriesMap.values()).sort((a, b) =>
      a.key.localeCompare(b.key),
    );

    // 13) utnyttjad kapacitet (MVP)
    // bookedUnits = antal bokningsdokument (live+archive) som är active inom perioden
    // capacityUnits = sum(activity.tracks) * antal “boknings-slots” i perioden (förenklad)
    // Vi kör förenklat: capacityUnits = totalTracks * dayCount * 8 (antag 8 slots/dag) om du inte vill räkna availability.
    // För att slippa "ljuga" visar vi både "approx" och "bookedUnits".
    const bookedUnits = all.filter((b) => b.status === "active").length;
    const totalTracks = activities.reduce(
      (s, a) => s + Number(a.tracks || 0),
      0,
    );

    const approxSlotsPerDay = 8;
    const capacityUnitsApprox = totalTracks * dayCount * approxSlotsPerDay;

    const utilizationApproxPct =
      capacityUnitsApprox > 0 ? (bookedUnits / capacityUnitsApprox) * 100 : 0;

    // 14) framåtblick: mest bokade dagar kommande 7 dagar (live Booking only)
    const todayISO = toISODateLocal(new Date());
    const to7 = addDaysISO(todayISO, 7);
    const futureFrom = startOfLocalDay(todayISO);
    const futureTo = endOfLocalDay(to7);

    const future = await Booking.find({
      workshopId: wsId,
      startAt: { $lte: futureTo },
      endAt: { $gte: futureFrom },
    })
      .select("activityId startAt status")
      .lean();

    const futureByDay = new Map();
    for (const b of future) {
      const dayKey = toISODateLocal(new Date(b.startAt));
      const actId = String(b.activityId || "");
      const mapKey = `${dayKey}__${actId}`;
      futureByDay.set(mapKey, (futureByDay.get(mapKey) || 0) + 1);
    }

    // gör en struktur: [{date, total, activities:[{activityTitle,count}]}]
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

    return res.json({
      ok: true,
      meta: { archivedMovedNow: archiveResult.moved },

      kpis: {
        totalBookings,
        totalCancellations,
        cancellationRate,
        preliminaryRevenue,
        actualRevenue,
        avgBookingsPerDay,
        avgLeadTimeHours,
        payOnsiteCount,
        payOnlineCount,
        unpaidAttention,
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
