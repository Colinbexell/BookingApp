import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import "./Admin.css";

import { Line, Bar, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
);

import Sidebar from "./components/Sidebar/Sidebar";
import ActivityCard from "./components/ActivityCard/ActivityCard";

import Plus from "../../assets/Plus_white.png";
import { API_BASE_URL } from "../../../config";

axios.defaults.baseURL = API_BASE_URL;
axios.defaults.withCredentials = true;

const dayNames = ["Sön", "Mån", "Tis", "Ons", "Tor", "Fre", "Lör"];

const pad2 = (n) => String(n).padStart(2, "0");

const toISODateLocal = (date) => {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return `${y}-${m}-${d}`;
};

const addDaysISO = (isoDate, days) => {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return toISODateLocal(dt);
};

const startOfISODateLocal = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
};

const endOfISODateLocal = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
};

const formatISO = (d) => toISODateLocal(d);

const getPresetRange = (preset) => {
  const now = new Date();
  const todayISO = formatISO(now);

  if (preset === "today") {
    return { from: todayISO, to: todayISO, groupBy: "day", label: "Idag" };
  }

  if (preset === "last_week") {
    // senaste 7 dagar inkl idag
    const from = formatISO(
      new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6),
    );
    return { from, to: todayISO, groupBy: "day", label: "Senaste veckan" };
  }

  if (preset === "last_month") {
    // senaste 30 dagar inkl idag (enkelt och stabilt)
    const from = formatISO(
      new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29),
    );
    return { from, to: todayISO, groupBy: "week", label: "Senaste månaden" };
  }

  if (preset === "last_year") {
    // senaste 12 månader tillbaka från idag
    const from = formatISO(
      new Date(now.getFullYear() - 1, now.getMonth(), now.getDate() + 1),
    );
    return { from, to: todayISO, groupBy: "month", label: "Senaste året" };
  }

  if (preset === "last_5_years") {
    const from = formatISO(
      new Date(now.getFullYear() - 5, now.getMonth(), now.getDate() + 1),
    );
    return { from, to: todayISO, groupBy: "year", label: "Senaste 5 åren" };
  }

  return { from: todayISO, to: todayISO, groupBy: "day", label: "Idag" };
};

const Admin = () => {
  const [user] = useState(() => JSON.parse(localStorage.getItem("userData")));
  const workshopId = user?.workshopId;

  const [page, setpage] = useState(1);

  // Data
  const [activities, setActivities] = useState([]);
  const [bookings, setBookings] = useState([]);

  // Kalender (workshop availability)
  const [weekly, setWeekly] = useState([
    { day: 1, open: "13:00", close: "17:00" },
    { day: 2, open: "13:00", close: "17:00" },
    { day: 3, open: "13:00", close: "17:00" },
    { day: 4, open: "13:00", close: "17:00" },
    { day: 5, open: "13:00", close: "17:00" },
  ]);
  const [exceptions, setExceptions] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  const [paymentOptions, setPaymentOptions] = useState({
    allowOnsite: true,
    allowOnline: true,
  });
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Filter för bokningar (1 datum = "business day")
  const [selectedDate, setSelectedDate] = useState(() =>
    toISODateLocal(new Date()),
  );

  const [bookingSearch, setBookingSearch] = useState("");
  const [bookingActivityFilter, setBookingActivityFilter] = useState("all"); // activityId | "all"
  const [bookingSort, setBookingSort] = useState("asc"); // "asc" = närmast först, "desc" = tvärtom

  // Statistik
  const [statsLoading, setStatsLoading] = useState(false);
  const [stats, setStats] = useState(null);

  const [statsPreset, setStatsPreset] = useState("today");

  const [chartTheme, setChartTheme] = useState({
    bookings: "#6495fe",
    cancellations: "#ef4444",
    preliminaryRevenue: "#f59e0b",
    actualRevenue: "#10b981",
    bars: "#5087ff",
    pieOnline: "#10b981",
    pieOnsite: "#f59e0b",
    grid: "rgba(148, 163, 184, 0.25)",
    text: "#0f172a",
  });

  const [chartAnimation, setChartAnimation] = useState(true);
  const [chartAnimationMs, setChartAnimationMs] = useState(800);

  // Avboknings Popup
  const [cancelPopupOpen, setCancelPopupOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null); // booking-raden
  const [isCancelling, setIsCancelling] = useState(false);

  // Bokningsdetaljer + betalningsverifiering
  const [bookingPopupOpen, setBookingPopupOpen] = useState(false);
  const [bookingTarget, setBookingTarget] = useState(null);

  const [verifyPopupOpen, setVerifyPopupOpen] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);

  // Popup skapa aktivitet
  const [newActPopupVisible, setNewActPopupVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editorMode, setEditorMode] = useState("create"); // "create" | "edit"
  const [selectedActivityId, setSelectedActivityId] = useState(null);

  // pricing form
  const [defaultPricePerHour, setDefaultPricePerHour] = useState(279);
  const [weeklyPricing, setWeeklyPricing] = useState([]);

  const emptyWeeklyPricing = () =>
    Array.from({ length: 7 }).map((_, day) => ({ day, ranges: [] }));

  // Ny aktivitet form
  const [title, setTitle] = useState("");
  const [information, setInformation] = useState("");

  const [takesPayment, setTakesPayment] = useState(true);
  const [bookingUnit, setBookingUnit] = useState("per_lane"); // per_lane | per_person
  const [partyMin, setPartyMin] = useState(1);
  const [partyMax, setPartyMax] = useState(8);

  // Bild variabler
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  //
  const [tracks, setTracks] = useState(2);
  const [useWorkshopAvailability, setUseWorkshopAvailability] = useState(true);
  const [slotMinutes, setSlotMinutes] = useState(60);
  const [minSlots, setMinSlots] = useState(1);
  const [maxSlots, setMaxSlots] = useState(2);

  const canUseAdmin = useMemo(() => !!workshopId, [workshopId]);

  // Hantera bilduppladning
  const uploadActivityImage = async () => {
    if (!imageFile) return toast.error("Välj en bild först");

    try {
      setIsUploadingImage(true);

      const form = new FormData();
      form.append("image", imageFile);

      const res = await axios.post("/upload/activity-image", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setImageUrl(res.data.imageUrl);
      toast.success("Bild uppladdad ✅");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Kunde inte ladda upp bild");
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Öppnar edit aktivitetsläge
  const openEdit = async (id) => {
    try {
      const res = await axios.get(`/activity/${id}`);
      const act = res.data.activity;
      setImageFile(null);

      setEditorMode("edit");
      setSelectedActivityId(id);

      setTitle(act.title || "");
      setInformation(act.information || "");
      setImageUrl(act.imageUrl || "");
      setTracks(act.tracks || 2);

      setTakesPayment(act.takesPayment !== false);

      setBookingUnit(act.bookingUnit || "per_lane");

      setPartyMin(Number(act.partyRules?.min ?? 1));
      setPartyMax(Number(act.partyRules?.max ?? 99));

      setUseWorkshopAvailability(
        act.useWorkshopAvailability !== false &&
          act.useWorkshopAvailability !== "false",
      );

      setSlotMinutes(act.bookingRules?.slotMinutes || 60);
      setMinSlots(act.bookingRules?.minSlots || 1);
      setMaxSlots(act.bookingRules?.maxSlots || 2);

      setDefaultPricePerHour(act.pricingRules?.defaultPricePerHour ?? 279);
      setWeeklyPricing(
        act.pricingRules?.weekly?.length
          ? act.pricingRules.weekly
          : emptyWeeklyPricing(),
      );

      setNewActPopupVisible(true);
    } catch {
      toast.error("Kunde inte öppna aktivitet");
    }
  };

  // Helpers för att sätta pris range
  const addPriceRange = (day) => {
    setWeeklyPricing((prev) =>
      prev.map((d) =>
        d.day === day
          ? {
              ...d,
              ranges: [
                ...d.ranges,
                { start: "15:00", end: "18:00", pricePerHour: 279 },
              ],
            }
          : d,
      ),
    );
  };

  const updatePriceRange = (day, idx, patch) => {
    setWeeklyPricing((prev) =>
      prev.map((d) =>
        d.day === day
          ? {
              ...d,
              ranges: d.ranges.map((r, i) =>
                i === idx ? { ...r, ...patch } : r,
              ),
            }
          : d,
      ),
    );
  };

  const removePriceRange = (day, idx) => {
    setWeeklyPricing((prev) =>
      prev.map((d) =>
        d.day === day
          ? { ...d, ranges: d.ranges.filter((_, i) => i !== idx) }
          : d,
      ),
    );
  };

  const confirmCancelBooking = async () => {
    if (!cancelTarget) return;

    try {
      setIsCancelling(true);
      await axios.patch("/booking/cancel", {
        bookingIds: cancelTarget.bookingIds,
      });
      toast.success("Bokningen avbokad ✅");
      setCancelPopupOpen(false);
      setCancelTarget(null);
      loadBookings();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Kunde inte avboka");
    } finally {
      setIsCancelling(false);
    }
  };

  // Öppna bokningsdetaljer (och ev. markera som betald på plats)
  const openBookingPopup = (b) => {
    setBookingTarget(b);
    setBookingPopupOpen(true);
  };

  const requestMarkPaid = () => {
    if (!bookingTarget) return;
    setVerifyPopupOpen(true);
  };

  const confirmMarkPaid = async () => {
    if (!bookingTarget) return;

    try {
      setIsMarkingPaid(true);

      await axios.patch("/booking/mark-paid", {
        bookingIds: bookingTarget.bookingIds,
      });

      toast.success("Markerad som betald ✅");
      setVerifyPopupOpen(false);
      setBookingPopupOpen(false);
      setBookingTarget(null);
      loadBookings();
    } catch (e) {
      toast.error(
        e?.response?.data?.message || "Kunde inte markera som betald",
      );
    } finally {
      setIsMarkingPaid(false);
    }
  };

  // --- Load activities ---
  const loadActivities = async () => {
    if (!workshopId) return;
    try {
      const res = await axios.get(`/activity?workshopId=${workshopId}`);
      setActivities(res.data.activities || []);
    } catch {
      toast.error("Kunde inte hämta aktiviteter");
    }
  };

  // --- Load statistics ---
  const loadStats = async () => {
    if (!workshopId) return;

    const { from, to, groupBy } = getPresetRange(statsPreset);

    try {
      setStatsLoading(true);
      const res = await axios.get(
        `/stats/workshop/${workshopId}?from=${from}&to=${to}&groupBy=${groupBy}`,
      );
      setStats(res.data);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Kunde inte hämta statistik");
    } finally {
      setStatsLoading(false);
    }
  };

  // --- Load bookings (workshop) ---
  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  const timeToMinutes = (hhmm) => {
    if (!hhmm || typeof hhmm !== "string") return null;
    const [h, m] = hhmm.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  };

  const makeLocalDateTime = (isoDate, hhmm) => {
    const [y, m, d] = isoDate.split("-").map(Number);
    const [hh, mm] = hhmm.split(":").map(Number);
    return new Date(y, m - 1, d, hh, mm, 0, 0);
  };

  // Tar fram "öppet fönster" för valt datum, och hanterar t.ex. 13:00–03:00.
  const getBusinessWindow = (isoDate) => {
    // 1) Exception för datum?
    const ex = exceptions.find((x) => x.date === isoDate);

    if (ex?.closed) {
      // Stängt hela dagen -> inget fönster
      return { startMs: null, endMs: null, isClosed: true };
    }

    let open = ex?.open || null;
    let close = ex?.close || null;

    // 2) Om ingen exception -> weekly för veckodagen
    if (!open || !close) {
      const [y, m, d] = isoDate.split("-").map(Number);
      const day = new Date(y, m - 1, d).getDay(); // 0-6
      const w = weekly.find((x) => x.day === day);

      // ✅ om dagen inte finns i weekly: anta hel dag så admin kan se bokningar ändå
      if (!w) {
        const start = makeLocalDateTime(isoDate, "00:00");
        const end = makeLocalDateTime(addDaysISO(isoDate, 1), "00:00");
        return {
          startMs: start.getTime(),
          endMs: end.getTime(),
          isClosed: false,
        };
      }

      open = w.open;
      close = w.close;
    }

    const openMin = timeToMinutes(open);
    const closeMin = timeToMinutes(close);
    if (openMin == null || closeMin == null) {
      return { startMs: null, endMs: null, isClosed: false };
    }

    const start = makeLocalDateTime(isoDate, open);

    // Om close <= open => passet går över midnatt (ex 13–03)
    const endDate = closeMin <= openMin ? addDaysISO(isoDate, 1) : isoDate;
    const end = makeLocalDateTime(endDate, close);

    return { startMs: start.getTime(), endMs: end.getTime(), isClosed: false };
  };

  const loadBookings = async () => {
    if (!workshopId) return;

    try {
      const to = addDaysISO(selectedDate, 1);

      const res = await axios.get(
        `/booking/workshop/${workshopId}?from=${selectedDate}&to=${to}`,
      );

      const normalized = (res.data.bookings || []).map((b) => {
        return {
          id: b.id,
          bookingIds: b.bookingIds || [],
          customerName: b.customerName || "Okänt namn",
          email: b.email || "",
          phone: b.phone || "",
          partySize: Number(b.partySize ?? 1),

          // 🔥 AKTIVITET
          activityId: b.activityId || b.activity?._id || b.activity?.id || "",
          activityTitle:
            b.activityTitle || b.activity?.title || "Okänd aktivitet",

          // ⏰ TID
          startAt: b.startAt,
          endAt: b.endAt,

          // 🎳 ANTAL BANOR
          quantity: b.quantity || 1,

          // 💳 BETALNING
          paymentStatus: b.paymentStatus || "unpaid", // paid | unpaid
          paymentMethod: b.paymentMethod || "onsite", // online | onsite

          // 📌 STATUS
          status: b.status || "active",

          // 💳 PRIS
          totalPrice: Number(b.totalPrice ?? 0),
          currency: b.currency || "SEK",
        };
      });

      setBookings(normalized);
    } catch {
      toast.error("Kunde inte hämta bokningar");
    }
  };

  // --- Load workshop availability ---
  const loadWorkshopAvailability = async () => {
    if (!workshopId) return;
    try {
      setCalendarLoading(true);
      const res = await axios.get(`/workshop/${workshopId}/availability`);
      const av = res.data?.availability;
      if (av?.weekly) setWeekly(av.weekly);
      if (av?.exceptions) setExceptions(av.exceptions);
    } catch {
      toast.error("Kunde inte hämta öppettider");
    } finally {
      setCalendarLoading(false);
    }
  };

  const loadWorkshopSettings = async () => {
    if (!workshopId) return;
    try {
      setPaymentLoading(true);
      const res = await axios.get(`/workshop/${workshopId}/settings`);
      const opts = res.data?.paymentOptions || {
        allowOnsite: true,
        allowOnline: true,
      };
      setPaymentOptions({
        allowOnsite: opts.allowOnsite !== false,
        allowOnline: opts.allowOnline !== false,
      });
    } catch {
      setPaymentOptions({ allowOnsite: true, allowOnline: true });
    } finally {
      setPaymentLoading(false);
    }
  };

  const saveWorkshopSettings = async () => {
    if (!workshopId) return;

    // stoppa att båda blir false
    if (!paymentOptions.allowOnsite && !paymentOptions.allowOnline) {
      toast.error("Minst ett betalsätt måste vara aktivt");
      return;
    }

    try {
      setPaymentLoading(true);
      await axios.patch(`/workshop/${workshopId}/settings`, {
        paymentOptions,
      });
      toast.success("Betalinställningar sparade ✅");
      loadWorkshopSettings();
    } catch (e) {
      toast.error(
        e?.response?.data?.message || "Kunde inte spara betalinställningar",
      );
    } finally {
      setPaymentLoading(false);
    }
  };

  useEffect(() => {
    if (!canUseAdmin) return;
    loadActivities();
  }, [canUseAdmin]);

  useEffect(() => {
    if (!canUseAdmin) return;

    if (page === 1) loadBookings();
    if (page === 2) loadActivities();
    if (page === 3) {
      loadWorkshopAvailability();
      loadWorkshopSettings();
    }
    if (page === 4) {
      loadActivities();
      loadStats();
    }
  }, [page, canUseAdmin, statsPreset]);

  // --- Create activity ---
  const submitActivity = async () => {
    if (!workshopId) return toast.error("Saknar workshopId i userData");

    if (!title.trim()) return toast.error("Titel saknas");
    if (!information.trim()) return toast.error("Info saknas");
    if (!imageUrl.trim()) return toast.error("Bild-URL saknas");
    if (!tracks || tracks < 1) return toast.error("Tracks måste vara minst 1");

    try {
      setIsSubmitting(true);

      const payload = {
        title,
        information,
        imageUrl,
        tracks: Number(tracks),
        workshopId,
        takesPayment,
        bookingUnit,
        partyRules: {
          min: Number(partyMin),
          max: Number(partyMax),
        },

        bookingRules: {
          slotMinutes: Number(slotMinutes),
          minSlots: Number(minSlots),
          maxSlots: Number(maxSlots),
        },
        pricingRules: {
          currency: "SEK",
          defaultPricePerHour: Number(defaultPricePerHour),
          weekly: weeklyPricing,
          exceptions: [],
        },
        useWorkshopAvailability,
      };

      if (editorMode === "create") {
        await axios.post("/activity/create", payload);
        toast.success("Aktivitet skapad ✅");
      } else {
        await axios.patch(`/activity/${selectedActivityId}`, payload);
        toast.success("Aktivitet uppdaterad ✅");
      }
      setImageFile(null);
      setImageUrl("");
      setNewActPopupVisible(false);
      loadActivities();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Kunde inte spara aktivitet");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Calendar save ---
  const saveWorkshopAvailability = async () => {
    if (!workshopId) return;

    try {
      setCalendarLoading(true);
      await axios.patch(`/workshop/${workshopId}/availability`, {
        weekly,
        exceptions,
      });
      toast.success("Öppettider sparade ✅");
      loadWorkshopAvailability();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Kunde inte spara öppettider");
    } finally {
      setCalendarLoading(false);
    }
  };

  const addException = () => {
    setExceptions((prev) => [
      ...prev,
      { date: "", closed: true, open: "", close: "", reason: "" },
    ]);
  };

  const updateException = (idx, patch) => {
    setExceptions((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)),
    );
  };

  const removeException = (idx) => {
    setExceptions((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateWeekly = (idx, patch) => {
    setWeekly((prev) =>
      prev.map((w, i) => (i === idx ? { ...w, ...patch } : w)),
    );
  };

  const statsCharts = useMemo(() => {
    const c = stats?.charts;
    const k = stats?.kpis;

    const timeSeries = c?.timeSeries || [];
    const labels = timeSeries.map((x) => x.key);

    const commonLine = {
      borderWidth: 2,
      pointRadius: 2,
      pointHoverRadius: 5,
      tension: 0.35,
    };

    const lineData = {
      labels,
      datasets: [
        {
          label: "Bokningar",
          data: timeSeries.map((x) => x.bookings || 0),
          borderColor: chartTheme.bookings,
          backgroundColor: chartTheme.bookings,
          ...commonLine,
        },
        {
          label: "Avbokningar",
          data: timeSeries.map((x) => x.cancellations || 0),
          borderColor: chartTheme.cancellations,
          backgroundColor: chartTheme.cancellations,
          ...commonLine,
        },
        {
          label: "Preliminär oms.",
          data: timeSeries.map((x) => x.preliminaryRevenue || 0),
          borderColor: chartTheme.preliminaryRevenue,
          backgroundColor: chartTheme.preliminaryRevenue,
          ...commonLine,
        },
        {
          label: "Faktisk oms.",
          data: timeSeries.map((x) => x.actualRevenue || 0),
          borderColor: chartTheme.actualRevenue,
          backgroundColor: chartTheme.actualRevenue,
          ...commonLine,
        },
      ],
    };

    const topActs = c?.topActivitiesByBookings || [];
    const topActsBar = {
      labels: topActs.map((x) => x.activityTitle || "Okänd"),
      datasets: [
        {
          label: "Bokningar",
          data: topActs.map((x) => x.count || 0),
          backgroundColor: chartTheme.bars,
          borderRadius: 8,
        },
      ],
    };

    const weekday = c?.weekdayCounts || [];
    const weekdayBar = {
      labels: weekday.map((x) => dayNames[x.weekday] || String(x.weekday)),
      datasets: [
        {
          label: "Bokningar",
          data: weekday.map((x) => x.count || 0),
          backgroundColor: chartTheme.bars,
          borderRadius: 8,
        },
      ],
    };

    const pieData = {
      labels: ["Online", "På plats"],
      datasets: [
        {
          label: "Betalningsmetod",
          data: [k?.payOnlineCount || 0, k?.payOnsiteCount || 0],
          backgroundColor: [chartTheme.pieOnline, chartTheme.pieOnsite],
          borderWidth: 0,
        },
      ],
    };

    const rangeInfo = getPresetRange(statsPreset);

    let periodBarTitle = "Bokningar";
    let periodBar = { labels: [], datasets: [] };

    if (statsPreset === "today" || statsPreset === "last_week") {
      periodBarTitle = "Bokningar per veckodag";
      const weekday = c?.weekdayCounts || [];
      periodBar = {
        labels: weekday.map((x) => dayNames[x.weekday] || String(x.weekday)),
        datasets: [
          {
            label: "Bokningar",
            data: weekday.map((x) => x.count || 0),
            backgroundColor: chartTheme.bars,
            borderRadius: 8,
          },
        ],
      };
    } else {
      // last_month -> weeks, last_year -> months, last_5_years -> years
      periodBarTitle =
        statsPreset === "last_month"
          ? "Bokningar per vecka (senaste månaden)"
          : statsPreset === "last_year"
            ? "Bokningar per månad (senaste året)"
            : "Bokningar per år (senaste 5 åren)";

      const ts = c?.timeSeries || [];
      periodBar = {
        labels: ts.map((x) => x.key),
        datasets: [
          {
            label: "Bokningar",
            data: ts.map((x) => (x.bookings || 0) + (x.cancellations || 0)),
            backgroundColor: chartTheme.bars,
            borderRadius: 8,
          },
        ],
      };
    }

    return { lineData, topActsBar, pieData, periodBar, periodBarTitle };
  }, [stats, chartTheme, statsPreset]);

  const chartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: chartAnimation
        ? { duration: chartAnimationMs, easing: "easeOutQuart" }
        : false,
      plugins: {
        legend: {
          labels: {
            color: chartTheme.text,
          },
        },
        tooltip: {
          enabled: true,
        },
      },
      scales: {
        x: {
          ticks: { color: chartTheme.text },
          grid: { color: chartTheme.grid },
        },
        y: {
          ticks: { color: chartTheme.text },
          grid: { color: chartTheme.grid },
        },
      },
    };
  }, [chartAnimation, chartAnimationMs, chartTheme]);

  const filteredBookings = useMemo(() => {
    const q = bookingSearch.trim().toLowerCase();

    const now = Date.now();
    const graceMs = 5 * 60 * 1000; // 5 minuter

    const { startMs, endMs, isClosed } = getBusinessWindow(selectedDate);
    if (isClosed) return [];

    const list = bookings
      // ✅ Visa bara bokningar som tillhör vald "business day"
      .filter((b) => {
        const start = new Date(b.startAt).getTime();
        if (startMs != null && start < startMs) return false;
        if (endMs != null && start >= endMs) return false;
        return true;
      })
      // ✅ Visa bara bokningar som inte har “löpt ut” (endAt + 5 min) – men bara för idag
      .filter((b) => {
        const todayISO = new Date().toISOString().slice(0, 10);
        const isToday = selectedDate === todayISO;

        if (!isToday) return true; // ✅ om du kollar annan dag: visa bokningarna ändå

        const endMsLocal = new Date(b.endAt).getTime();
        return endMsLocal + graceMs > now;
      })

      // ✅ filter: aktivitet (default = all)
      .filter((b) => {
        if (bookingActivityFilter === "all") return true;
        return b.activityId === bookingActivityFilter;
      })
      // ✅ sök
      .filter((b) => {
        if (!q) return true;
        return (
          (b.customerName || "").toLowerCase().includes(q) ||
          (b.email || "").toLowerCase().includes(q) ||
          (b.phone || "").toLowerCase().includes(q)
        );
      })
      // ✅ sort: närmast först (asc) eller tvärtom (desc)
      .sort((a, b) => {
        const aStart = new Date(a.startAt).getTime();
        const bStart = new Date(b.startAt).getTime();
        return bookingSort === "asc" ? aStart - bStart : bStart - aStart;
      });

    return list;
  }, [
    bookings,
    bookingSearch,
    bookingActivityFilter,
    bookingSort,
    selectedDate,
    weekly,
    exceptions,
  ]);

  // --- UI pages ---
  const renderBookings = () => {
    return (
      <div className="admin-content">
        <div className="admin-inner">
          <div className="admin-card">
            <div className="bookings-head">
              <div>
                <h3 style={{ margin: 0 }}>Bokningar</h3>
              </div>

              <div className="bookings-controls">
                {/* 🎯 Aktivitet-filter */}
                <select
                  className="booking-select"
                  value={bookingActivityFilter}
                  onChange={(e) => setBookingActivityFilter(e.target.value)}
                >
                  <option value="all">Alla aktiviteter</option>
                  {activities.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>

                {/* ↕️ Sortering */}
                <select
                  className="booking-select"
                  value={bookingSort}
                  onChange={(e) => setBookingSort(e.target.value)}
                >
                  <option value="asc">Närmast tid först</option>
                  <option value="desc">Senast tid först</option>
                </select>

                {/* 🔎 Sök */}
                <input
                  className="booking-search"
                  type="text"
                  placeholder="Sök namn, mail eller telefon…"
                  value={bookingSearch}
                  onChange={(e) => setBookingSearch(e.target.value)}
                />

                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />

                <button className="admin-btn secondary" onClick={loadBookings}>
                  Uppdatera
                </button>
              </div>
            </div>

            <div className="bookings-table">
              <div className="bookings-row bookings-header">
                <div>Namn</div>
                <div>Aktivitet</div>
                <div>Tid</div>
                <div>Personer</div>
                <div>Banor</div>
                <div>Pris</div>
                <div>Betalning</div>
                <div>Status</div>
              </div>

              {filteredBookings.length === 0 ? (
                <div className="empty-state">
                  Inga bokningar för valt datum.
                </div>
              ) : (
                filteredBookings.map((b) => {
                  const start = capitalize(
                    new Date(b.startAt).toLocaleString("sv-SE", {
                      weekday: "short",
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
                  );

                  const end = new Date(b.endAt).toLocaleTimeString("sv-SE", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  const paymentLabel =
                    b.paymentStatus === "paid"
                      ? b.paymentMethod === "onsite"
                        ? "Betald (på plats)"
                        : "Betald (online)"
                      : b.paymentMethod === "onsite"
                        ? "Obetald (på plats)"
                        : "Obetald";

                  return (
                    <div
                      key={b.id}
                      className="bookings-row"
                      onClick={() => openBookingPopup(b)}
                      style={{ cursor: "pointer" }}
                    >
                      {/* 👤 Namn */}
                      <div>
                        <strong>{b.customerName}</strong>
                      </div>

                      {/* 🎯 Aktivitet */}
                      <div>{b.activityTitle}</div>

                      {/* ⏰ Tid */}
                      <div className="booking-time">
                        <strong>{start}</strong>
                        <span className="muted"> – {end}</span>
                      </div>

                      {/* 👥 Personer */}
                      <div>
                        <span className="badge">{b.partySize} st</span>
                      </div>

                      {/* 🎳 Banor */}
                      <div>
                        <span className="badge">{b.quantity} st</span>
                      </div>

                      {/* 💳 Pris */}
                      <div>
                        <strong>
                          {Math.round(b.totalPrice)} {b.currency}
                        </strong>
                        {b.quantity > 1 ? (
                          <div className="booking-subprice">
                            {Math.round(b.totalPrice / b.quantity)} {b.currency}
                            /st
                          </div>
                        ) : null}
                      </div>

                      {/* 💳 Betalning */}
                      <div>
                        <span
                          className={`status-pill ${
                            b.paymentStatus === "paid" ? "paid" : "unpaid"
                          }`}
                        >
                          {paymentLabel}
                        </span>
                      </div>

                      {/* 📌 Status */}
                      <div>
                        <span
                          className={`status-pill ${
                            b.status === "active" ? "ok" : "bad"
                          }`}
                        >
                          {b.status === "active" ? "Aktiv" : "Avbokad"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderActivities = () => {
    return (
      <div className="admin-content">
        <div className="admin-inner">
          <div className="admin-topbar">
            <div>
              <h1>Aktiviteter</h1>
              <p>Skapa, visa och hantera aktiviteter.</p>
            </div>

            <div className="admin-actions">
              <button
                className="admin-btn"
                onClick={() => {
                  setEditorMode("create");
                  setSelectedActivityId(null);
                  setWeeklyPricing(emptyWeeklyPricing());
                  setDefaultPricePerHour(279);
                  setNewActPopupVisible(true);
                }}
              >
                + Skapa aktivitet
              </button>
            </div>
          </div>

          <div className="admin-card">
            <p className="admin-muted">Här ser du alla aktiviteter.</p>
          </div>

          <div className="act-div">
            {activities.map((a) => (
              <ActivityCard
                key={a.id}
                title={a.title}
                imageUrl={a.imageUrl}
                tracks={a.tracks}
                onClick={() => openEdit(a.id)}
              />
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderCalendar = () => {
    return (
      <div className="admin-content">
        <div className="admin-inner">
          <div className="admin-topbar">
            <div>
              <h1>Kalender</h1>
              <p>Ställ in öppettider och hantera undantag</p>
            </div>
          </div>
          <div className="admin-card">
            <div className="calendar-head">
              <div>
                <h3 style={{ margin: 0 }}>Veckoschema</h3>
                <p className="admin-muted" style={{ margin: "6px 0 0 0" }}>
                  Ställ in öppettider per veckodag. Om en dag är “stängd” visas
                  inga tider för kunder.
                </p>
              </div>

              <button
                className="admin-btn secondary"
                onClick={() => {
                  // Snabbpreset: Mån–Fre 13-17, helg stängt
                  setWeekly([
                    { day: 1, open: "13:00", close: "17:00" },
                    { day: 2, open: "13:00", close: "17:00" },
                    { day: 3, open: "13:00", close: "17:00" },
                    { day: 4, open: "13:00", close: "17:00" },
                    { day: 5, open: "13:00", close: "17:00" },
                  ]);
                }}
              >
                Reset preset
              </button>
            </div>

            <div className="weekly-cards">
              {Array.from({ length: 7 }).map((_, day) => {
                const idx = weekly.findIndex((x) => x.day === day);
                const w = idx !== -1 ? weekly[idx] : null;
                const isOpen = !!w;

                return (
                  <div
                    key={day}
                    className={`weekly-card ${isOpen ? "" : "closed"}`}
                  >
                    <div className="weekly-left">
                      <div className="weekly-day-pill">{dayNames[day]}</div>
                      <div
                        className={`weekly-status ${
                          isOpen ? "open" : "closed"
                        }`}
                      >
                        {isOpen ? "Öppet" : "Stängt"}
                      </div>
                    </div>

                    <div className="weekly-right">
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={isOpen}
                          onChange={(e) => {
                            const nextOpen = e.target.checked;

                            if (nextOpen) {
                              // Lägg till dag med default
                              setWeekly((prev) => {
                                const next = [
                                  ...prev,
                                  { day, open: "13:00", close: "17:00" },
                                ];
                                return next.sort((a, b) => a.day - b.day);
                              });
                            } else {
                              // Ta bort dag => stängt
                              setWeekly((prev) =>
                                prev.filter((x) => x.day !== day),
                              );
                            }
                          }}
                        />
                        <span className="toggle-ui" />
                        <span className="toggle-text">Öppet</span>
                      </label>

                      <div className={`time-pair ${isOpen ? "" : "disabled"}`}>
                        <div className="time-field">
                          <div className="time-label">Öppnar</div>
                          <input
                            type="time"
                            value={w?.open || "13:00"}
                            disabled={!isOpen}
                            onChange={(e) =>
                              updateWeekly(idx, { open: e.target.value })
                            }
                          />
                        </div>

                        <div className="time-sep">→</div>

                        <div className="time-field">
                          <div className="time-label">Stänger</div>
                          <input
                            type="time"
                            value={w?.close || "17:00"}
                            disabled={!isOpen}
                            onChange={(e) =>
                              updateWeekly(idx, { close: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="admin-card">
            <div
              className="admin-row"
              style={{ justifyContent: "space-between" }}
            >
              <h3>Undantag</h3>
              <button className="admin-btn" onClick={addException}>
                + Lägg till
              </button>
            </div>

            {exceptions.length === 0 ? (
              <p style={{ opacity: 0.8 }}>Inga undantag ännu ✨</p>
            ) : (
              <div className="exceptions-list">
                {exceptions.map((e, idx) => (
                  <div key={idx} className="exception-item">
                    <input
                      type="date"
                      value={e.date}
                      onChange={(ev) =>
                        updateException(idx, { date: ev.target.value })
                      }
                    />

                    <select
                      value={e.closed ? "closed" : "open"}
                      onChange={(ev) =>
                        updateException(idx, {
                          closed: ev.target.value === "closed",
                        })
                      }
                    >
                      <option value="closed">Stängt</option>
                      <option value="open">Specialöppet</option>
                    </select>

                    {!e.closed && (
                      <>
                        <input
                          type="time"
                          value={e.open || ""}
                          onChange={(ev) =>
                            updateException(idx, { open: ev.target.value })
                          }
                        />
                        <input
                          type="time"
                          value={e.close || ""}
                          onChange={(ev) =>
                            updateException(idx, { close: ev.target.value })
                          }
                        />
                      </>
                    )}

                    <input
                      type="text"
                      placeholder="Reason (valfritt)"
                      value={e.reason || ""}
                      onChange={(ev) =>
                        updateException(idx, { reason: ev.target.value })
                      }
                    />

                    <button
                      className="admin-btn danger"
                      onClick={() => removeException(idx)}
                    >
                      Ta bort
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="admin-card">
            <button
              className="admin-btn"
              onClick={saveWorkshopAvailability}
              disabled={calendarLoading}
            >
              {calendarLoading ? "Sparar..." : "Spara öppettider"}
            </button>
          </div>

          <div className="admin-card">
            <div className="calendar-head">
              <div>
                <h3 style={{ margin: 0 }}>Betalning</h3>
                <p className="admin-muted" style={{ margin: "6px 0 0 0" }}>
                  Välj vilka betalsätt kunder får använda i bokningen.
                </p>
              </div>

              <button
                className="admin-btn"
                onClick={saveWorkshopSettings}
                disabled={paymentLoading}
              >
                {paymentLoading ? "Sparar..." : "Spara betalsätt"}
              </button>
            </div>

            <div className="weekly-cards">
              <div className="weekly-card">
                <div className="weekly-left">
                  <div className="weekly-day-pill">Onsite</div>
                  <div
                    className={`weekly-status ${
                      paymentOptions.allowOnsite ? "open" : "closed"
                    }`}
                  >
                    {paymentOptions.allowOnsite ? "Aktiv" : "Av"}
                  </div>
                </div>

                <div className="weekly-right">
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={paymentOptions.allowOnsite}
                      onChange={(e) =>
                        setPaymentOptions((p) => ({
                          ...p,
                          allowOnsite: e.target.checked,
                        }))
                      }
                    />
                    <span className="toggle-ui" />
                    <span className="toggle-text">Betala på plats</span>
                  </label>
                </div>
              </div>

              <div className="weekly-card">
                <div className="weekly-left">
                  <div className="weekly-day-pill">Online</div>
                  <div
                    className={`weekly-status ${
                      paymentOptions.allowOnline ? "open" : "closed"
                    }`}
                  >
                    {paymentOptions.allowOnline ? "Aktiv" : "Av"}
                  </div>
                </div>

                <div className="weekly-right">
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={paymentOptions.allowOnline}
                      onChange={(e) =>
                        setPaymentOptions((p) => ({
                          ...p,
                          allowOnline: e.target.checked,
                        }))
                      }
                    />
                    <span className="toggle-ui" />
                    <span className="toggle-text">Betala online</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStats = () => {
    const k = stats?.kpis;
    const rangeInfo = getPresetRange(statsPreset);

    const isStatsReady =
      !!stats &&
      !!statsCharts?.lineData?.labels &&
      !!statsCharts?.topActsBar?.labels &&
      !!statsCharts?.pieData?.labels &&
      !!statsCharts?.periodBar?.labels;

    return (
      <div className="admin-content">
        <div className="admin-inner">
          <div className="admin-topbar">
            <div>
              <h1>Statistik</h1>
              <p>Överblick, intäkter, beteende och uppföljning.</p>
            </div>

            <div className="admin-actions">
              <select
                className="booking-select stats-preset-select"
                value={statsPreset}
                onChange={(e) => setStatsPreset(e.target.value)}
              >
                <option value="today">Idag</option>
                <option value="last_week">Senaste vecka (veckodagar)</option>
                <option value="last_month">Senaste månad (veckor)</option>
                <option value="last_year">Senaste år (månader)</option>
                <option value="last_5_years">Senaste 5 år (år)</option>
              </select>

              <button className="admin-btn secondary" onClick={loadStats}>
                {statsLoading ? "Laddar..." : "Uppdatera"}
              </button>
            </div>
          </div>

          <div className="admin-card" style={{ padding: "12px 16px" }}>
            <div className="admin-muted" style={{ fontSize: 13 }}>
              Filter: <strong>{rangeInfo.label}</strong>
              {" • "}
              Period:{" "}
              <strong>
                {rangeInfo.from} → {rangeInfo.to}
              </strong>
              {" • "}
              Aggregering:{" "}
              <strong>
                {rangeInfo.groupBy === "day"
                  ? "per dag"
                  : rangeInfo.groupBy === "week"
                    ? "per vecka"
                    : rangeInfo.groupBy === "month"
                      ? "per månad"
                      : "per år"}
              </strong>
            </div>
          </div>

          <div className="admin-card">
            <h3 style={{ marginTop: 0 }}>KPI</h3>

            <div className="booking-modal-grid">
              <div className="booking-field">
                <div className="booking-label">Totala bokningar</div>
                <div className="booking-value">{k?.totalBookings || 0}</div>
              </div>

              <div className="booking-field">
                <div className="booking-label">Avbokningar</div>
                <div className="booking-value">
                  {k?.totalCancellations || 0}
                </div>
              </div>

              <div className="booking-field">
                <div className="booking-label">Avbokningsgrad</div>
                <div className="booking-value">
                  {(k?.cancellationRate || 0).toFixed(1)}%
                </div>
              </div>

              <div className="booking-field">
                <div className="booking-label">Preliminär omsättning</div>
                <div className="booking-value">
                  {Math.round(k?.preliminaryRevenue || 0)} SEK
                </div>
              </div>

              <div className="booking-field">
                <div className="booking-label">Faktisk omsättning</div>
                <div className="booking-value">
                  {Math.round(k?.actualRevenue || 0)} SEK
                </div>
              </div>

              <div className="booking-field">
                <div className="booking-label">Snitt bokningar/dag</div>
                <div className="booking-value">
                  {(k?.avgBookingsPerDay || 0).toFixed(2)}
                </div>
              </div>

              <div className="booking-field">
                <div className="booking-label">Lead time (snitt)</div>
                <div className="booking-value">
                  {(k?.avgLeadTimeHours || 0).toFixed(1)} h
                </div>
              </div>

              <div className="booking-field">
                <div className="booking-label">Obetalda (passerade)</div>
                <div className="booking-value">{k?.unpaidAttention || 0}</div>
              </div>

              <div className="booking-field">
                <div className="booking-label">
                  Utnyttjad kapacitet (approx)
                </div>
                <div className="booking-value">
                  {(k?.utilizationApproxPct || 0).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          {!isStatsReady ? (
            <div className="admin-card">
              <p className="admin-muted" style={{ margin: 0 }}>
                Laddar statistik…
              </p>
            </div>
          ) : (
            <>
              <div className="admin-card">
                <h3 style={{ marginTop: 0 }}>
                  Bokningar & omsättning över tid
                </h3>
                <p className="admin-muted" style={{ marginTop: 4 }}>
                  Visar bokningar och omsättning grupperat{" "}
                  <strong>
                    {rangeInfo.groupBy === "day"
                      ? "per dag"
                      : rangeInfo.groupBy === "week"
                        ? "per vecka"
                        : rangeInfo.groupBy === "month"
                          ? "per månad"
                          : "per år"}
                  </strong>{" "}
                  för vald period.
                </p>

                <div style={{ width: "100%", height: 340 }}>
                  <Line data={statsCharts.lineData} options={chartOptions} />
                </div>
              </div>

              <div className="admin-card">
                <h3 style={{ marginTop: 0 }}>{statsCharts.periodBarTitle}</h3>
                <p className="admin-muted" style={{ marginTop: 4 }}>
                  {statsPreset === "today" || statsPreset === "last_week"
                    ? "Visar veckodagar (Sön–Lör) för vald period."
                    : statsPreset === "last_month"
                      ? "Varje stapel är en vecka (grupperat per vecka)."
                      : statsPreset === "last_year"
                        ? "Varje stapel är en månad (grupperat per månad)."
                        : "Varje stapel är ett år (grupperat per år)."}
                </p>

                <div style={{ width: "100%", height: 340 }}>
                  <Bar data={statsCharts.periodBar} options={chartOptions} />
                </div>
              </div>

              <div className="admin-card">
                <h3 style={{ marginTop: 0 }}>Populäraste aktiviteter</h3>
                <p className="admin-muted" style={{ marginTop: 4 }}>
                  Antal bokningar per aktivitet för{" "}
                  <strong>{rangeInfo.label}</strong> ({rangeInfo.from} →{" "}
                  {rangeInfo.to}).
                </p>

                <div style={{ width: "100%", height: 340 }}>
                  <Bar data={statsCharts.topActsBar} options={chartOptions} />
                </div>
              </div>

              <div className="admin-card">
                <h3 style={{ marginTop: 0 }}>Betalningsmetod</h3>
                <p className="admin-muted" style={{ marginTop: 4 }}>
                  Fördelning av bokningar baserat på valt betalsätt.
                </p>

                <div style={{ width: "100%", height: 340 }}>
                  <Pie
                    data={statsCharts.pieData}
                    options={{
                      ...chartOptions,
                      scales: undefined,
                    }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (!canUseAdmin) {
      return (
        <div className="admin-content">
          <h1>Admin</h1>
          <p style={{ opacity: 0.8 }}>
            Hittar inget <strong>workshopId</strong> i userData. Lägg in det så
            admin kan jobba multi-tenant ✅
          </p>
        </div>
      );
    }

    if (page === 1) return renderBookings();
    if (page === 2) return renderActivities();
    if (page === 3) return renderCalendar();
    if (page === 4) return renderStats();

    return null;
  };

  return (
    <div>
      <Sidebar page={page} setpage={setpage} />
      {renderContent()}

      {/* Ny aktivitet / redigera aktivitets pop up */}
      {newActPopupVisible ? (
        <div className="popup" onClick={() => setNewActPopupVisible(false)}>
          <div className="new-act-window" onClick={(e) => e.stopPropagation()}>
            <h2>Skapa ny aktivitet</h2>

            <div className="new-act-input">
              <h3 className="new-act-h3">Titel</h3>
              <input
                type="text"
                className="normal-input"
                placeholder="Ange titel"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="new-act-input">
              <h3 className="new-act-h3">Information</h3>
              <textarea
                className="normal-input"
                placeholder="Beskriv aktiviteten"
                value={information}
                onChange={(e) => setInformation(e.target.value)}
                rows={4}
              />
            </div>

            <div className="pricing-card">
              <h3 className="pricing-title">Prissättning</h3>
              <p className="admin-muted pricing-subtitle">
                Default gäller om ingen regel matchar. Veckoregler kan ge olika
                pris per tid och dag.
              </p>

              <div className="admin-row admin-row-half pricing-default-row">
                <div className="admin-field pricing-default-field">
                  <p>Default (kr/timme)</p>
                  <input
                    type="number"
                    min="0"
                    value={defaultPricePerHour}
                    onChange={(e) => setDefaultPricePerHour(e.target.value)}
                  />
                </div>
              </div>

              <div className="weekly-grid weekly-grid-spacing">
                {weeklyPricing.map((d) => (
                  <div key={d.day} className="admin-card pricing-day-card">
                    <div className="admin-row pricing-day-header">
                      <strong>{dayNames[d.day]}</strong>
                      <button
                        className="admin-btn secondary"
                        onClick={() => addPriceRange(d.day)}
                      >
                        + Lägg till intervall
                      </button>
                    </div>

                    {d.ranges.length === 0 ? (
                      <p className="admin-muted pricing-empty">
                        Inga regler (defaultpris används)
                      </p>
                    ) : (
                      <div className="exceptions-list pricing-ranges">
                        {d.ranges.map((r, idx) => (
                          <div
                            key={idx}
                            className="exception-item pricing-range-row"
                          >
                            <input
                              type="time"
                              value={r.start}
                              onChange={(e) =>
                                updatePriceRange(d.day, idx, {
                                  start: e.target.value,
                                })
                              }
                            />
                            <input
                              type="time"
                              value={r.end}
                              onChange={(e) =>
                                updatePriceRange(d.day, idx, {
                                  end: e.target.value,
                                })
                              }
                            />
                            <input
                              type="number"
                              min="0"
                              value={r.pricePerHour}
                              onChange={(e) =>
                                updatePriceRange(d.day, idx, {
                                  pricePerHour: e.target.value,
                                })
                              }
                              placeholder="kr/timme"
                            />
                            <div className="pricing-range-spacer" />
                            <button
                              className="admin-btn danger"
                              onClick={() => removePriceRange(d.day, idx)}
                            >
                              Ta bort
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="new-act-input">
              <h3 className="new-act-h3">Bild</h3>

              <div className="image-upload-row">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                />

                <button
                  className="admin-btn secondary"
                  type="button"
                  onClick={uploadActivityImage}
                  disabled={isUploadingImage || !imageFile}
                >
                  {isUploadingImage ? "Laddar upp..." : "Ladda upp"}
                </button>
              </div>

              {imageUrl ? (
                <div className="image-preview">
                  <img src={API_BASE_URL + imageUrl} alt="Preview" />
                  <p className="admin-muted">{imageUrl}</p>
                </div>
              ) : (
                <p className="admin-muted">Ingen bild uppladdad ännu.</p>
              )}
            </div>

            <div className="admin-row admin-row-half admin-row-gap-md admin-row-top-md">
              <div className="admin-field">
                <p>Banor</p>
                <input
                  type="number"
                  min="1"
                  value={tracks}
                  onChange={(e) => setTracks(e.target.value)}
                />
              </div>

              <div className="admin-field">
                <p>Slot (min)</p>
                <input
                  type="number"
                  min="15"
                  step="15"
                  value={slotMinutes}
                  onChange={(e) => setSlotMinutes(e.target.value)}
                />
              </div>
            </div>
            <div className="form-row">
              <label>Tar aktiviteten betalt?</label>
              <select
                value={takesPayment ? "yes" : "no"}
                onChange={(e) => setTakesPayment(e.target.value === "yes")}
              >
                <option value="yes">Ja (betald)</option>
                <option value="no">Nej (gratis)</option>
              </select>
            </div>

            <div className="form-row">
              <label>Bokas / debiteras per</label>
              <select
                value={bookingUnit}
                onChange={(e) => setBookingUnit(e.target.value)}
              >
                <option value="per_lane">Bana</option>
                <option value="per_person">Person</option>
              </select>
            </div>

            {bookingUnit === "per_person" && (
              <div className="form-row" style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label>Min personer i sällskap</label>
                  <input
                    type="number"
                    min={1}
                    value={partyMin}
                    onChange={(e) => setPartyMin(Number(e.target.value))}
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <label>Max personer i sällskap</label>
                  <input
                    type="number"
                    min={1}
                    value={partyMax}
                    onChange={(e) => setPartyMax(Number(e.target.value))}
                  />
                </div>
              </div>
            )}

            <div className="admin-row admin-row-half admin-row-gap-md admin-row-top-md">
              <div className="admin-field">
                <p>Min timmar</p>
                <input
                  type="number"
                  min="1"
                  max="2"
                  value={minSlots}
                  onChange={(e) => setMinSlots(e.target.value)}
                />
              </div>

              <div className="admin-field">
                <p>Max timmar</p>
                <input
                  type="number"
                  min="1"
                  max="2"
                  value={maxSlots}
                  onChange={(e) => setMaxSlots(e.target.value)}
                />
              </div>
            </div>

            <div className="admin-row admin-row-half admin-row-top-lg">
              <label className="admin-checkbox-row">
                <input
                  type="checkbox"
                  checked={useWorkshopAvailability}
                  onChange={(e) => setUseWorkshopAvailability(e.target.checked)}
                />
                Använd workshopens öppettider (rekommenderas)
              </label>
            </div>

            <div className="admin-row admin-row-half admin-row-top-xl admin-actions-row">
              <button
                className="admin-btn danger"
                onClick={() => setNewActPopupVisible(false)}
              >
                Avbryt
              </button>

              {editorMode === "edit" ? (
                <button
                  className="admin-btn danger"
                  onClick={async () => {
                    try {
                      setIsSubmitting(true);
                      await axios.delete(`/activity/${selectedActivityId}`);
                      toast.success("Aktivitet borttagen ✅");
                      setNewActPopupVisible(false);
                      loadActivities();
                    } catch {
                      toast.error("Kunde inte ta bort aktivitet");
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  disabled={isSubmitting}
                >
                  Ta bort aktivitet
                </button>
              ) : null}

              <button
                className="admin-btn"
                onClick={submitActivity}
                disabled={isSubmitting}
              >
                {editorMode === "edit"
                  ? isSubmitting
                    ? "Uppdaterar..."
                    : "Uppdatera aktivitet"
                  : isSubmitting
                    ? "Skapar..."
                    : "Skapa aktivitet"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Bokningsdetaljer */}
      {bookingPopupOpen ? (
        <div
          className="popup"
          onClick={() => {
            if (isMarkingPaid) return;
            setBookingPopupOpen(false);
            setBookingTarget(null);
          }}
        >
          <div className="booking-modal" onClick={(e) => e.stopPropagation()}>
            <div className="booking-modal-head">
              <div>
                <h2 className="booking-modal-title">Bokning</h2>
                <p className="booking-modal-sub">
                  Bokningsreferens: <strong>{bookingTarget?.id}</strong>
                </p>
              </div>

              <button
                className="admin-btn secondary small"
                onClick={() => {
                  if (isMarkingPaid) return;
                  setBookingPopupOpen(false);
                  setBookingTarget(null);
                }}
              >
                Stäng
              </button>
            </div>

            <div className="booking-modal-grid">
              <div className="booking-field">
                <div className="booking-label">Kund</div>
                <div className="booking-value">
                  {bookingTarget?.customerName}
                </div>
              </div>

              <div className="booking-field">
                <div className="booking-label">Telefonnummer</div>
                <div className="booking-value">{bookingTarget?.phone}</div>
              </div>

              <div className="booking-field">
                <div className="booking-label">E-post</div>
                <div className="booking-value">{bookingTarget?.email}</div>
              </div>

              <div className="booking-field">
                <div className="booking-label">Aktivitet</div>
                <div className="booking-value">
                  {bookingTarget?.activityTitle}
                </div>
              </div>

              <div className="booking-field">
                <div className="booking-label">Tid</div>
                <div className="booking-value">
                  {bookingTarget?.startAt
                    ? new Date(bookingTarget.startAt).toLocaleString("sv-SE", {
                        weekday: "long",
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : ""}
                  {bookingTarget?.endAt
                    ? ` – ${new Date(bookingTarget.endAt).toLocaleTimeString(
                        "sv-SE",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}`
                    : ""}
                </div>
              </div>

              <div className="booking-field">
                <div className="booking-label">Sällskap</div>
                <div className="booking-value">
                  {bookingTarget?.partySize} st
                </div>
              </div>

              <div className="booking-field">
                <div className="booking-label">Banor</div>
                <div className="booking-value">
                  {bookingTarget?.quantity} st
                </div>
              </div>

              <div className="booking-field">
                <div className="booking-label">Pris</div>
                <div className="booking-value">
                  {Math.round(bookingTarget?.totalPrice || 0)}{" "}
                  {bookingTarget?.currency || "SEK"}
                </div>
              </div>

              <div className="booking-field">
                <div className="booking-label">Betalning</div>
                <div className="booking-value">
                  <span
                    className={`status-pill ${
                      bookingTarget?.paymentStatus === "paid"
                        ? "paid"
                        : "unpaid"
                    }`}
                  >
                    {bookingTarget?.paymentStatus === "paid"
                      ? bookingTarget?.paymentMethod === "onsite"
                        ? "Betald (på plats)"
                        : "Betald (online)"
                      : bookingTarget?.paymentMethod === "onsite"
                        ? "Obetald (på plats)"
                        : "Obetald"}
                  </span>
                </div>
              </div>

              <div className="booking-field">
                <div className="booking-label">Status</div>
                <div className="booking-value">
                  <span
                    className={`status-pill ${
                      bookingTarget?.status === "active" ? "ok" : "bad"
                    }`}
                  >
                    {bookingTarget?.status === "active" ? "Aktiv" : "Avbokad"}
                  </span>
                </div>
              </div>
            </div>

            <div className="booking-modal-actions">
              {bookingTarget?.status === "active" ? (
                <button
                  className="admin-btn danger"
                  onClick={() => {
                    setBookingPopupOpen(false);
                    setCancelTarget(bookingTarget);
                    setCancelPopupOpen(true);
                  }}
                >
                  Avboka bokning
                </button>
              ) : null}

              {bookingTarget?.status === "active" &&
              bookingTarget?.paymentMethod === "onsite" &&
              bookingTarget?.paymentStatus !== "paid" ? (
                <button
                  className="admin-btn"
                  onClick={requestMarkPaid}
                  disabled={isMarkingPaid}
                >
                  Markera som betald
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Confirm: verifiera betalning */}
      {verifyPopupOpen ? (
        <div
          className="popup"
          onClick={() => {
            if (isMarkingPaid) return;
            setVerifyPopupOpen(false);
          }}
        >
          <div className="confirm-window" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-top">
              <div className="confirm-icon">!</div>
              <div>
                <h2 className="confirm-title">Verifiera betalning</h2>
                <p className="confirm-sub">
                  Är du säker att du vill verifiera att{" "}
                  <strong>{bookingTarget?.customerName}</strong> har betalat på
                  plats?
                </p>
              </div>
            </div>

            <div className="confirm-details">
              <div className="confirm-chip">{bookingTarget?.activityTitle}</div>
              <div className="confirm-chip">
                {Math.round(bookingTarget?.totalPrice || 0)}{" "}
                {bookingTarget?.currency || "SEK"}
              </div>
              <div className="confirm-chip">Ref: {bookingTarget?.id}</div>
            </div>

            <div className="confirm-actions">
              <button
                className="admin-btn secondary"
                onClick={() => {
                  if (isMarkingPaid) return;
                  setVerifyPopupOpen(false);
                }}
              >
                Nej, stäng
              </button>

              <button
                className="admin-btn"
                onClick={confirmMarkPaid}
                disabled={isMarkingPaid}
              >
                {isMarkingPaid ? "Verifierar..." : "Ja, verifiera"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Avboknings pop up */}
      {cancelPopupOpen ? (
        <div
          className="popup"
          onClick={() => {
            if (isCancelling) return;
            setCancelPopupOpen(false);
            setCancelTarget(null);
          }}
        >
          <div className="confirm-window" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-top">
              <div className="confirm-icon">!</div>
              <div>
                <h2 className="confirm-title">Avboka bokning</h2>
                <p className="confirm-sub">
                  Är du säker att du vill avboka bokning för{" "}
                  <strong>{cancelTarget?.customerName}</strong>?
                </p>
              </div>
            </div>

            <div className="confirm-details">
              <div className="confirm-chip">{cancelTarget?.email}</div>
              <div className="confirm-chip">{cancelTarget?.phone}</div>
              <div className="confirm-chip">
                {cancelTarget?.quantity} bana(or)
              </div>
              <div className="confirm-chip">
                {Math.round(cancelTarget?.totalPrice || 0)}{" "}
                {cancelTarget?.currency || "SEK"}
              </div>
              <div className="confirm-chip">{cancelTarget?.activityTitle}</div>
            </div>

            <div className="confirm-actions">
              <button
                className="admin-btn secondary"
                onClick={() => {
                  if (isCancelling) return;
                  setCancelPopupOpen(false);
                  setCancelTarget(null);
                }}
              >
                Nej, stäng
              </button>

              <button
                className="admin-btn danger"
                onClick={confirmCancelBooking}
                disabled={isCancelling}
              >
                {isCancelling ? "Avbokar..." : "Ja, avboka"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Admin;
