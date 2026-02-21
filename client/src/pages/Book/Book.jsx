import React, { useEffect, useMemo, useState } from "react";
import "./Book.css";
import Navbar from "../../components/navbar/Navbar";
import Activity from "./Activity";
import axios from "axios";
import { toast } from "react-hot-toast";
import { API_BASE_URL } from "../../../config";

axios.defaults.baseURL = API_BASE_URL;
axios.defaults.withCredentials = true;

// --------------------
// date helpers (Sweden local)
// --------------------
const pad2 = (n) => String(n).padStart(2, "0");
const toISODate = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const isTodayISO = (dateISO) => {
  const todayISO = toISODate(new Date());
  return dateISO === todayISO;
};

const addDaysISO = (dateISO, days) => {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return toISODate(dt);
};

const startOfWeekISO = (dateISO) => {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay(); // 0=sön, 1=mån...
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  dt.setDate(dt.getDate() + diffToMonday);
  return toISODate(dt);
};

const timeLabelSV = (startISO) => {
  const dt = new Date(startISO);
  return dt.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
};

const dayLabelSV = (dateISO) => {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const wd = dt.toLocaleDateString("sv-SE", { weekday: "short" });
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)} ${d}`;
};

const buildWeekDaysFromSlots = (weekStartISO, slots) => {
  const byDate = new Map();
  for (const s of slots || []) {
    const dateKey = String(s.startISO || "").slice(0, 10);
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey).push(s);
  }

  const days = [];
  for (let i = 0; i < 7; i++) {
    const dateISO = addDaysISO(weekStartISO, i);
    const daySlots = (byDate.get(dateISO) || []).slice().sort((a, b) => {
      return new Date(a.startISO).getTime() - new Date(b.startISO).getTime();
    });

    days.push({
      date: dateISO,
      label: dayLabelSV(dateISO),
      slots: daySlots,
    });
  }

  return days;
};

const Book = () => {
  const [page, setPage] = useState(1);

  const [selectedDate, setSelectedDate] = useState(() => toISODate(new Date()));

  // tenant/workshop
  const [workshopId] = useState(() => {
    try {
      return localStorage.getItem("selectedWorkshopId") || "";
    } catch {
      return "";
    }
  });

  // customer info (page 3)
  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // payment (page 4)
  const [paymentMethod, setPaymentMethod] = useState("onsite"); // onsite | online
  const [paymentOptions, setPaymentOptions] = useState({
    allowOnsite: true,
    allowOnline: true,
  });
  const [loadingPaymentOptions, setLoadingPaymentOptions] = useState(false);

  // activities from API
  const [activities, setActivities] = useState([]);
  const [loadingActs, setLoadingActs] = useState(false);

  // cart: { activityId, amount1, amount2, selections: [{startISO, durationSlots}] }
  const [bookData, setBookData] = useState(() => {
    try {
      const saved = localStorage.getItem("bookData");
      const parsed = saved ? JSON.parse(saved) : [];
      return parsed.map((b) => ({ ...b, selections: b.selections || [] }));
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("bookData", JSON.stringify(bookData));
  }, [bookData]);

  // --------------------
  // Load activities
  // --------------------
  const loadActivities = async () => {
    if (!workshopId) {
      setActivities([]);
      toast.error("Saknar selectedWorkshopId (tenant)");
      return;
    }

    try {
      setLoadingActs(true);
      const res = await axios.get(`/activity?workshopId=${workshopId}`);

      const mapped = (res.data.activities || []).map((a) => ({
        id: String(a.id || a._id),
        title: a.title,
        info: a.information,
        img: a.imageUrl,
        tracks: a.tracks,
        takesPayment: a.takesPayment !== false,
        bookingUnit: a.bookingUnit || "per_lane",
        partyRules: a.partyRules || { min: 1, max: 99 },
        bookingRules: a.bookingRules || {
          slotMinutes: 60,
          minSlots: 1,
          maxSlots: 2,
        },
        // Om du inte har pricing i backend ännu: håll 0 så länge
        pricePerSlot: Number(a.pricePerSlot || 0),
      }));

      setActivities(mapped);
    } catch {
      toast.error("Kunde inte hämta aktiviteter");
      setActivities([]);
    } finally {
      setLoadingActs(false);
    }
  };

  const loadWorkshopSettings = async () => {
    if (!workshopId) return;

    try {
      setLoadingPaymentOptions(true);
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
      // fallback: visa båda om settings inte finns ännu
      setPaymentOptions({ allowOnsite: true, allowOnline: true });
    } finally {
      setLoadingPaymentOptions(false);
    }
  };

  const [nowTick, setNowTick] = useState(0);

  useEffect(() => {
    if (page !== 2) return;
    const id = setInterval(() => setNowTick((x) => x + 1), 60_000);
    return () => clearInterval(id);
  }, [page]);

  useEffect(() => {
    loadActivities();
    loadWorkshopSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workshopId]);

  useEffect(() => {
    // Om nuvarande val inte är tillåtet -> välj första tillåtna
    if (paymentMethod === "onsite" && !paymentOptions.allowOnsite) {
      setPaymentMethod(paymentOptions.allowOnline ? "online" : "onsite");
    }
    if (paymentMethod === "online" && !paymentOptions.allowOnline) {
      setPaymentMethod(paymentOptions.allowOnsite ? "onsite" : "online");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentOptions.allowOnsite, paymentOptions.allowOnline]);

  // --------------------
  // Cart helpers
  // --------------------
  const getActivityById = (id) => activities.find((a) => a.id === id);

  const updateBookData = (field, value, activityId) => {
    const act = getActivityById(activityId);
    const isPerPerson = act?.bookingUnit === "per_person";

    const minP = Number(act?.partyRules?.min ?? 1);
    const maxP = Number(act?.partyRules?.max ?? 99);

    const existingIndex = bookData.findIndex(
      (b) => b.activityId === activityId,
    );

    // ✅ SPECIAL: partySize ska kunna vara 0 (= inte vald) för per_person
    if (field === "partySize") {
      const raw = Number(value || 0);

      // 0 => ta bort aktiviteten från kundvagnen (så den inte följer med “spöklikt”)
      if (raw <= 0) {
        if (existingIndex !== -1) {
          const updated = [...bookData];
          updated.splice(existingIndex, 1);
          setBookData(updated);
        }
        return;
      }

      // Annars: clamp till [minP..maxP]
      const nextPartySize = Math.min(maxP, Math.max(minP, raw));

      if (existingIndex !== -1) {
        const updated = [...bookData];
        const current = updated[existingIndex];

        const nextObj = {
          ...current,
          partySize: nextPartySize,
          // ✅ viktigt: tvinga INTE amount1=1 här
          // (vi sätter default i nextPage när man går vidare till tider)
          amount1: Number(current.amount1 || 0),
          amount2: Number(current.amount2 || 0),
        };

        const need = (nextObj.amount1 || 0) + (nextObj.amount2 || 0);
        nextObj.selections = (nextObj.selections || []).slice(0, need);

        updated[existingIndex] = nextObj;
        setBookData(updated);
        return;
      }

      // ✅ ingen rad ännu -> skapa en direkt, men utan att auto-välja tider/count
      setBookData([
        ...bookData,
        {
          activityId,
          amount1: 0,
          amount2: 0,
          selections: [],
          partySize: nextPartySize,
        },
      ]);
      return;
    }

    // ---- standardflöde (amount1/amount2) ----
    if (existingIndex !== -1) {
      const updated = [...bookData];
      const current = updated[existingIndex];

      const nextObj = { ...current, [field]: value };

      // per_person: se till att man aldrig hamnar på 0 total
      if (isPerPerson) {
        const total = (nextObj.amount1 || 0) + (nextObj.amount2 || 0);
        if (total === 0) nextObj.amount1 = 1;

        // per_person: om partySize saknas, sätt till min
        if (!nextObj.partySize || Number(nextObj.partySize) < minP) {
          nextObj.partySize = minP;
        }
      }

      const need = (nextObj.amount1 || 0) + (nextObj.amount2 || 0);
      nextObj.selections = (nextObj.selections || []).slice(0, need);

      // ta bort bara om per_lane och båda 0
      if (
        !isPerPerson &&
        (nextObj.amount1 || 0) === 0 &&
        (nextObj.amount2 || 0) === 0
      ) {
        setBookData(updated.filter((_, idx) => idx !== existingIndex));
      } else {
        updated[existingIndex] = nextObj;
        setBookData(updated);
      }
    } else {
      if (value > 0) {
        setBookData([
          ...bookData,
          {
            activityId,
            amount1: field === "amount1" ? value : 0,
            amount2: field === "amount2" ? value : 0,
            selections: [],
            // ✅ om per_person: starta på min, annars 1
            partySize: isPerPerson ? minP : 1,
          },
        ]);
      }
    }
  };

  const getActivityBookData = (activityId) => {
    return (
      bookData.find((b) => b.activityId === activityId) || {
        activityId,
        amount1: 0,
        amount2: 0,
        selections: [],
        partySize: 0,
      }
    );
  };

  const neededCounts = (booking) => {
    const need1 = booking.amount1 || 0;
    const need2 = booking.amount2 || 0;
    return { need1, need2, needTotal: need1 + need2 };
  };

  const selectedCounts = (booking) => {
    const selections = booking.selections || [];
    const sel1 = selections.filter((s) => s.durationSlots === 1).length;
    const sel2 = selections.filter((s) => s.durationSlots === 2).length;
    return { sel1, sel2, selTotal: selections.length };
  };

  const calcSelectionPrice = (activityId, startISO, durationSlots) => {
    const av = availabilityMap[activityId];
    const slots = av?.slots || [];
    if (!slots.length) return 0;

    const idx = slots.findIndex((s) => s.startISO === startISO);
    if (idx === -1) return 0;

    let sum = 0;
    for (let i = 0; i < durationSlots; i++) {
      const s = slots[idx + i];
      if (!s) return 0;
      sum += Number(s.slotPrice || 0);
    }

    // snygg avrundning
    return Math.round(sum * 100) / 100;
  };

  const calculateTotal = () => {
    return bookData.reduce((total, booking) => {
      const selections = booking.selections || [];
      const sum = selections.reduce((acc, sel) => {
        return (
          acc +
          calcSelectionPrice(
            booking.activityId,
            sel.startISO,
            sel.durationSlots,
          )
        );
      }, 0);

      const act = activities.find((a) => a.id === booking.activityId);
      const multiplier =
        act?.bookingUnit === "per_person" ? Number(booking.partySize || 1) : 1;

      return total + sum * multiplier;
    }, 0);
  };

  // --------------------
  // Availability (API)
  // --------------------
  const [availabilityMap, setAvailabilityMap] = useState({});
  const [loadingAvail, setLoadingAvail] = useState(false);

  const loadAvailabilityForSelected = async () => {
    const selectedIds = bookData
      .filter((b) => (b.amount1 || 0) > 0 || (b.amount2 || 0) > 0)
      .map((b) => b.activityId);

    const uniqueIds = Array.from(new Set(selectedIds));
    if (uniqueIds.length === 0) {
      setAvailabilityMap({});
      return;
    }

    try {
      setLoadingAvail(true);

      const weekStart = startOfWeekISO(selectedDate); // måndag
      const from = weekStart;
      const to = addDaysISO(weekStart, 7); // 7 dagar (exclusive)

      const results = await Promise.all(
        uniqueIds.map(async (id) => {
          const res = await axios.get(
            `/activity/${id}/availability?from=${from}&to=${to}`,
          );
          return [id, res.data];
        }),
      );

      const next = {};
      for (const [id, data] of results) next[id] = data;
      setAvailabilityMap(next);
    } catch {
      toast.error("Kunde inte hämta lediga tider");
      setAvailabilityMap({});
    } finally {
      setLoadingAvail(false);
    }
  };

  const selectedActivityIdsKey = useMemo(() => {
    return bookData
      .filter((b) => (b.amount1 || 0) > 0 || (b.amount2 || 0) > 0)
      .map((b) => b.activityId)
      .sort()
      .join("|");
  }, [bookData]);

  useEffect(() => {
    if (page === 2) loadAvailabilityForSelected();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, selectedDate, selectedActivityIdsKey]);

  const getCoveredStartISOs = (activityId) => {
    const b = getActivityBookData(activityId);
    const av = availabilityMap[activityId];
    const slots = av?.slots || [];
    if (!slots.length) return new Set();

    const indexByStart = new Map(slots.map((s, i) => [s.startISO, i]));
    const covered = new Set();

    for (const sel of b.selections || []) {
      const startIdx = indexByStart.get(sel.startISO);
      if (startIdx === undefined) continue;

      for (let i = 0; i < (sel.durationSlots || 1); i++) {
        const s = slots[startIdx + i];
        if (s) covered.add(s.startISO);
      }
    }

    return covered;
  };

  // visar om slotten är start på en 2h-block (för “leading” highlight)
  const isTwoHourStart = (activityId, startISO) => {
    const b = getActivityBookData(activityId);
    return (b.selections || []).some(
      (sel) => sel.startISO === startISO && sel.durationSlots === 2,
    );
  };

  // visar om slotten är “andra delen” av en 2h-block (för “tail” highlight)
  const isTwoHourTail = (activityId, startISO) => {
    const b = getActivityBookData(activityId);
    const av = availabilityMap[activityId];
    const slots = av?.slots || [];
    const idx = slots.findIndex((s) => s.startISO === startISO);
    if (idx === -1) return false;

    // om någon 2h selection startar på slotten precis innan denna
    const prev = slots[idx - 1];
    if (!prev) return false;

    return (b.selections || []).some(
      (sel) => sel.durationSlots === 2 && sel.startISO === prev.startISO,
    );
  };

  // --------------------
  // Picking slots
  // --------------------
  const takenCountInCartForSlot = (activityId, startISO, slotMinutes) => {
    const cart = getActivityBookData(activityId);
    const selections = cart.selections || [];
    const slotStart = new Date(startISO).getTime();
    const slotEnd = slotStart + slotMinutes * 60_000;

    return selections.reduce((acc, sel) => {
      const selStart = new Date(sel.startISO).getTime();
      const selEnd = selStart + sel.durationSlots * slotMinutes * 60_000;
      const covers = selStart < slotEnd && slotStart < selEnd;
      return acc + (covers ? 1 : 0);
    }, 0);
  };

  const canPickStart = (activityId, idx, durationSlots) => {
    const av = availabilityMap[activityId];
    if (!av) return false;

    const slots = av.slots || [];
    const slotMinutes = av.slotMinutes || 60;

    for (let i = 0; i < durationSlots; i++) {
      const slot = slots[idx + i];
      if (!slot) return false;

      const usedInCart = takenCountInCartForSlot(
        activityId,
        slot.startISO,
        slotMinutes,
      );
      const effectiveAvailable = Math.max(
        0,
        (slot.availableTracks || 0) - usedInCart,
      );

      if (effectiveAvailable <= 0) return false;
    }
    return true;
  };

  const pickTime = (activityId, startISO, durationSlots) => {
    const av = availabilityMap[activityId];
    const slots = av?.slots || [];

    // hitta index för slotten så canPickStart kan kolla "i rad"
    const idx = slots.findIndex((s) => s.startISO === startISO);
    if (idx === -1) return;

    // server+cart capacity check
    if (!canPickStart(activityId, idx, durationSlots)) {
      toast.error("Den tiden har inte tillräcklig kapacitet kvar.");
      return;
    }

    setBookData((prev) =>
      prev.map((b) => {
        if (b.activityId !== activityId) return b;

        const need = (b.amount1 || 0) + (b.amount2 || 0);
        const selections = b.selections || [];

        // stoppa om man redan valt allt man behöver
        if (selections.length >= need) return b;

        // Tillåt samma startISO flera gånger (för flera banor),
        // men vi litar på canPickStart så att capacity inte överskrids.
        return {
          ...b,
          selections: [...selections, { startISO, durationSlots }],
        };
      }),
    );
  };

  const removeSelection = (activityId, index) => {
    setBookData((prev) =>
      prev.map((b) =>
        b.activityId === activityId
          ? {
              ...b,
              selections: (b.selections || []).filter((_, i) => i !== index),
            }
          : b,
      ),
    );
  };

  // --------------------
  // Navigation validation
  // --------------------
  const canGoNextFromTimes = useMemo(() => {
    if (bookData.length === 0) return false;
    return bookData.every((b) => {
      const need = (b.amount1 || 0) + (b.amount2 || 0);
      return (b.selections || []).length === need;
    });
  }, [bookData]);

  const nextPage = () => {
    if (page === 1) {
      if (bookData.length === 0) return;

      // ✅ per_person: om man valt aktiviteten men inte valt 1h/2h-count,
      // sätt default till 1x 1h så man kan välja en tid i nästa steg.
      setBookData((prev) =>
        prev.map((b) => {
          const act = getActivityById(b.activityId);
          if (!act) return b;

          const hasCounts = (b.amount1 || 0) + (b.amount2 || 0) > 0;

          if (act.bookingUnit === "per_person" && !hasCounts) {
            return { ...b, amount1: 1, amount2: 0 };
          }
          return b;
        }),
      );

      setPage(2);
      return;
    }

    if (page === 2) {
      if (bookData.length !== 0 && canGoNextFromTimes) setPage(3);
      else toast.error("Välj alla tider innan du går vidare");
      return;
    }

    if (page === 3) {
      if (!customerName.trim() || !email.trim() || !phone.trim()) {
        toast.error("Fyll i namn, mail och telefon");
        return;
      }

      // ✅ validera partySize per aktivitet
      for (const b of bookData) {
        const act = getActivityById(b.activityId);
        if (!act) continue;

        const ps = Number(b.partySize || 1);

        if (ps < 1) {
          toast.error(`Välj antal personer för ${act.title}`);
          return;
        }

        if (act.bookingUnit === "per_person") {
          const minP = Number(act.partyRules?.min ?? 1);
          const maxP = Number(act.partyRules?.max ?? 99);

          if (ps < minP || ps > maxP) {
            toast.error(
              `${act.title}: sällskap måste vara mellan ${minP} och ${maxP}`,
            );
            return;
          }
        }
      }

      setPage(4);
    }
  };

  // --------------------
  // Submit bookings
  // --------------------
  const [submittingBooking, setSubmittingBooking] = useState(false);

  const submitBookings = async () => {
    try {
      setSubmittingBooking(true);

      if (!customerName.trim() || !email.trim() || !phone.trim()) {
        toast.error("Fyll i namn, mail och telefon");
        return;
      }

      const workshopId = localStorage.getItem("selectedWorkshopId") || "";
      if (!workshopId) {
        toast.error("Saknar workshopId");
        return;
      }

      const items = bookData.flatMap((b) =>
        (b.selections || []).map((sel) => ({
          activityId: b.activityId,
          startISO: sel.startISO,
          durationSlots: sel.durationSlots,
          partySize: Number(b.partySize || 1),
        })),
      );

      if (items.length === 0) {
        toast.error("Inga tider valda");
        return;
      }

      // ✅ 1) Onsite -> skapa bokningar direkt (som tidigare)
      if (paymentMethod === "onsite") {
        const payload = items.map((it) => ({
          ...it,
          customerName,
          email,
          phone,
          paymentMethod: "onsite",
        }));

        const results = await Promise.allSettled(
          payload.map((p) => axios.post("/booking/create", p)),
        );

        const failed = results.filter((r) => r.status === "rejected");
        if (failed.length > 0) {
          const err = failed[0].reason;
          const status = err?.response?.status;
          const msg =
            err?.response?.data?.message ||
            err?.response?.data?.error ||
            "Bokning misslyckades";

          if (status === 409) {
            toast.error(
              "Minst en bokning misslyckades (någon hann boka före). Uppdatera tider.",
            );
            await loadAvailabilityForSelected();
            return;
          }

          toast.error(msg);
          return;
        }

        toast.success("Bokning klar 🎉");
        localStorage.removeItem("bookData");
        setBookData([]);
        setCustomerName("");
        setEmail("");
        setPhone("");
        setPaymentMethod("onsite");
        setPage(1);
        return;
      }

      // ✅ 2) Online -> skapa INGA bokningar, bara Stripe Checkout (via HOLD)
      const res = await axios.post("/payment/create-checkout-session", {
        workshopId,
        items,
        customer: { customerName, email, phone },
      });

      const url = res.data?.url;
      if (!url) {
        toast.error("Kunde inte starta betalning");
        return;
      }

      window.location.href = url;
    } catch (e) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        "Kunde inte slutföra";
      toast.error(msg);
    } finally {
      setSubmittingBooking(false);
    }
  };

  // --------------------
  // UI
  // --------------------
  const renderPage = () => {
    switch (page) {
      case 1:
        return (
          <div className="content">
            {loadingActs ? (
              <p style={{ opacity: 0.8 }}>Laddar aktiviteter...</p>
            ) : (
              <div className="activities">
                {activities.map((act) => (
                  <Activity
                    key={act.id}
                    title={act.title}
                    id={act.id}
                    img={act.img}
                    info={act.info}
                    cost={act.pricePerSlot || 0}
                    updateBookData={updateBookData}
                    nextPage={nextPage}
                    bookData={getActivityBookData(act.id)}
                    bookingUnit={act.bookingUnit}
                    partyRules={act.partyRules}
                  />
                ))}
              </div>
            )}
          </div>
        );

      case 2: {
        const selected = bookData.filter(
          (b) => (b.amount1 || 0) > 0 || (b.amount2 || 0) > 0,
        );

        return (
          <div className="content booking-page">
            <div className="booking-header">
              <div>
                <h1 className="booking-title">Välj tid</h1>
                <p className="booking-subtitle">
                  Välj tider för de aktiviteter du lagt i din bokning.
                </p>
              </div>
              <div className="booking-datebox">
                <div className="datebox-label">Datum</div>
                <div className="datebox-controls">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="date-input"
                  />
                  <button
                    className="btn btn-secondary"
                    onClick={loadAvailabilityForSelected}
                  >
                    Uppdatera
                  </button>
                </div>
              </div>
            </div>

            <div className="booking-grid">
              <div className="panel">
                {loadingAvail ? (
                  <p className="muted">Laddar tider...</p>
                ) : (
                  selected.map((b) => {
                    const activity = activities.find(
                      (a) => a.id === b.activityId,
                    );
                    if (!activity) return null;

                    const av = availabilityMap[b.activityId];
                    const slots = av?.slots || [];
                    const { need1, need2 } = neededCounts(b);
                    const { sel1, sel2 } = selectedCounts(b);

                    const needMore1 = sel1 < need1;
                    const needMore2 = sel2 < need2;

                    return (
                      <div key={b.activityId} className="activity-block">
                        <div className="activity-head">
                          <div>
                            <h3 className="activity-name">{activity.title}</h3>
                            <p className="muted" style={{ margin: 0 }}>
                              Antal banor: <strong>{activity.tracks}</strong>
                            </p>
                          </div>
                        </div>

                        {slots.length === 0 ? (
                          <div className="empty-state">
                            Inga tider denna dag (stängt eller undantag).
                          </div>
                        ) : (
                          (() => {
                            const weekStart = startOfWeekISO(selectedDate);
                            const rawWeekDays = buildWeekDaysFromSlots(
                              weekStart,
                              slots,
                            );

                            const todayISO = toISODate(new Date());
                            const todayStartMs = new Date(
                              `${todayISO}T00:00:00`,
                            ).getTime();
                            const nowMs = Date.now();

                            const weekDays = rawWeekDays.map((day) => {
                              const dayStartMs = new Date(
                                `${day.date}T00:00:00`,
                              ).getTime();

                              // 1) Om dagen är i det förflutna: visa dagen men inga tider
                              if (dayStartMs < todayStartMs) {
                                return { ...day, slots: [], isPastDay: true };
                              }

                              // 2) Om dagen är idag: filtrera bort tider som startar nu eller tidigare
                              if (day.date === todayISO) {
                                return {
                                  ...day,
                                  isPastDay: false,
                                  slots: (day.slots || []).filter((slot) => {
                                    const startMs = new Date(
                                      slot.startISO,
                                    ).getTime();
                                    return startMs > nowMs;
                                  }),
                                };
                              }

                              // 3) Framtida dagar: behåll allt
                              return { ...day, isPastDay: false };
                            });

                            const covered = getCoveredStartISOs(b.activityId);

                            return (
                              <div className="week-calendar">
                                {weekDays.map((day) => (
                                  <div key={day.date} className="week-day">
                                    <div className="week-day-header">
                                      {day.label}
                                    </div>

                                    {day.slots.length === 0 ? (
                                      <div className="week-day-empty">—</div>
                                    ) : (
                                      day.slots.map((slot) => {
                                        const slotMinutes =
                                          av?.slotMinutes || 60;
                                        const usedInCart =
                                          takenCountInCartForSlot(
                                            b.activityId,
                                            slot.startISO,
                                            slotMinutes,
                                          );

                                        const effectiveAvailable = Math.max(
                                          0,
                                          (slot.availableTracks || 0) -
                                            usedInCart,
                                        );

                                        const isFull = effectiveAvailable <= 0;
                                        const isLow =
                                          !isFull && effectiveAvailable <= 1;

                                        const durationSlots = needMore1
                                          ? 1
                                          : needMore2
                                            ? 2
                                            : 1;

                                        const idx = slots.findIndex(
                                          (s) => s.startISO === slot.startISO,
                                        );
                                        const canStartHere =
                                          durationSlots === 1
                                            ? !isFull
                                            : canPickStart(
                                                b.activityId,
                                                idx,
                                                2,
                                              );

                                        const isSelected = covered.has(
                                          slot.startISO,
                                        );

                                        return (
                                          <button
                                            key={slot.startISO}
                                            type="button"
                                            className={[
                                              "time-pill",
                                              isSelected ? "selected" : "",
                                              isFull
                                                ? "is-full"
                                                : isLow
                                                  ? "is-low"
                                                  : "is-ok",
                                            ].join(" ")}
                                            disabled={!canStartHere}
                                            onClick={() =>
                                              pickTime(
                                                b.activityId,
                                                slot.startISO,
                                                durationSlots,
                                              )
                                            }
                                            title={
                                              isFull
                                                ? "Fullt"
                                                : durationSlots === 2 &&
                                                    !canStartHere
                                                  ? "Kan inte boka 2h här"
                                                  : "Boka"
                                            }
                                          >
                                            <span className="time-pill-time">
                                              {timeLabelSV(slot.startISO)}
                                            </span>
                                            <span className="time-pill-price">
                                              {Number(
                                                slot.slotPrice || 0,
                                              ).toFixed(0)}{" "}
                                              kr
                                            </span>
                                          </button>
                                        );
                                      })
                                    )}
                                  </div>
                                ))}
                              </div>
                            );
                          })()
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* RIGHT */}
              <div className="panel panel-sticky">
                <div className="panel-header">
                  <h2 className="panel-title">Din bokning</h2>
                  <div
                    className={`status ${
                      canGoNextFromTimes ? "status-ok" : "status-warn"
                    }`}
                  >
                    {canGoNextFromTimes
                      ? "Redo att gå vidare"
                      : "Välj alla tider"}
                  </div>
                </div>

                <div className="summary-list">
                  {selected.map((book) => {
                    const activity = activities.find(
                      (a) => a.id === book.activityId,
                    );
                    if (!activity) return null;

                    const { need1, need2, needTotal } = neededCounts(book);
                    const { sel1, sel2, selTotal } = selectedCounts(book);

                    return (
                      <div key={book.activityId} className="summary-card">
                        <div className="summary-top">
                          <strong>{activity.title}</strong>
                          <span className="muted">
                            {selTotal}/{needTotal} valda
                          </span>
                        </div>

                        {/* <div className="summary-metrics">
                          <div className="metric">
                            <span className="muted">1h</span>
                            <strong>
                              {sel1}/{need1}
                            </strong>
                          </div>
                          <div className="metric">
                            <span className="muted">2h</span>
                            <strong>
                              {sel2}/{need2}
                            </strong>
                          </div>
                        </div> */}

                        {(book.selections || []).length > 0 && (
                          <div className="selected-list">
                            {(book.selections || []).map((sel, i) => (
                              <div
                                key={`${sel.startISO}-${i}`}
                                className="selected-row"
                              >
                                <div className="selected-text">
                                  <div className="selected-time">
                                    {new Date(sel.startISO).toLocaleString(
                                      "sv-SE",
                                      {
                                        weekday: "short",
                                        month: "2-digit",
                                        day: "2-digit",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      },
                                    )}
                                  </div>
                                  <div className="muted">
                                    {sel.durationSlots}h
                                  </div>
                                </div>
                                <div className="muted">
                                  {calcSelectionPrice(
                                    book.activityId,
                                    sel.startISO,
                                    sel.durationSlots,
                                  ).toFixed(0)}{" "}
                                  kr
                                </div>
                                <button
                                  className="btn btn-ghost"
                                  onClick={() =>
                                    removeSelection(book.activityId, i)
                                  }
                                >
                                  Ta bort
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="summary-footer">
                  <div className="total-row">
                    <span className="muted">Totalt</span>
                    <strong>{calculateTotal()},00 kr</strong>
                  </div>

                  <div className="actions">
                    <button
                      className="btn btn-ghost"
                      onClick={() => setPage(1)}
                    >
                      Tillbaka
                    </button>
                    <button
                      className="btn"
                      onClick={nextPage}
                      disabled={!canGoNextFromTimes}
                    >
                      Nästa
                    </button>
                  </div>

                  {!canGoNextFromTimes && (
                    <div className="hint">
                      Tips: du måste välja exakt lika många tider som du valt
                      antal 1h/2h för varje aktivitet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      }

      // ✅ NY: Page 3 använder “pro”-layouten från Book.css
      case 3:
        const shouldShowPartyPanel = bookData.some((b) => {
          const act = activities.find((a) => a.id === b.activityId);
          return act && act.bookingUnit !== "per_person";
        });
        return (
          <div className="content booking-page">
            <div className="booking-header">
              <div>
                <h1 className="booking-title">Ange uppgifter</h1>
                <p className="booking-subtitle">
                  Fyll i kontaktuppgifter så personalen kan hitta din bokning
                  snabbt.
                </p>
              </div>
            </div>

            <div className="booking-grid booking-grid-single">
              <div className="panel">
                <div className="panel-header">
                  <h2 className="panel-title">Kontakt</h2>
                </div>

                <div className="form-grid">
                  <div className="field">
                    <label>Namn</label>
                    <input
                      className="text-input"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Förnamn Efternamn"
                    />
                  </div>

                  <div className="field">
                    <label>Mail</label>
                    <input
                      className="text-input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="namn@mail.com"
                    />
                  </div>

                  <div className="field">
                    <label>Telefon</label>
                    <input
                      className="text-input"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="070-123 45 67"
                    />
                  </div>
                  {shouldShowPartyPanel && (
                    <div
                      className="panel"
                      style={{ width: "100%", maxWidth: 600, marginTop: 16 }}
                    >
                      <h3 style={{ marginTop: 0 }}>Sällskap</h3>

                      {bookData.map((b) => {
                        const act = activities.find(
                          (a) => a.id === b.activityId,
                        );
                        if (!act) return null;

                        // ✅ bara per_lane visas här
                        if (act.bookingUnit === "per_person") return null;

                        const minP = Number(act.partyRules?.min ?? 1);
                        const maxP = Number(act.partyRules?.max ?? 99);

                        return (
                          <div key={b.activityId} style={{ marginBottom: 14 }}>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                              }}
                            >
                              <strong>{act.title}</strong>
                              <span className="muted">Per bana</span>
                            </div>

                            <label
                              className="muted"
                              style={{ display: "block", marginTop: 6 }}
                            >
                              Antal personer i sällskapet (för statistik)
                            </label>

                            <input
                              type="number"
                              min={1}
                              max={999}
                              value={b.partySize || 1}
                              onChange={(e) => {
                                const v = Number(e.target.value || 1);
                                setBookData((prev) =>
                                  prev.map((x) =>
                                    x.activityId === b.activityId
                                      ? { ...x, partySize: v }
                                      : x,
                                  ),
                                );
                              }}
                              style={{ width: "100%" }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="actions">
                    <button
                      className="btn btn-ghost"
                      onClick={() => setPage(2)}
                    >
                      Tillbaka
                    </button>
                    <button className="btn" onClick={nextPage}>
                      Nästa
                    </button>
                  </div>
                </div>
              </div>

              <div className="panel panel-soft">
                <div className="panel-header">
                  <h2 className="panel-title">Snabb översikt</h2>
                </div>

                <div className="mini-summary">
                  <div>
                    <div className="muted">Datum</div>
                    <strong>{selectedDate}</strong>
                  </div>
                  <div>
                    <div className="muted">Totalt</div>
                    <strong>{calculateTotal()},00 kr</strong>
                  </div>
                </div>

                <div className="hint" style={{ marginTop: 12 }}>
                  Tips: samma namn + tid räcker vid kassan — personalen hittar
                  dig direkt.
                </div>
              </div>
            </div>
          </div>
        );

      // ✅ NY: Page 4 använder “payment”-klasserna från Book.css
      case 4:
        return (
          <div className="content booking-page">
            <div className="booking-header">
              <div>
                <h1 className="booking-title">Betalning</h1>
                <p className="booking-subtitle">
                  Välj om du vill betala på plats (obetald) eller direkt
                  (betald).
                </p>
              </div>
            </div>

            <div className="booking-grid booking-grid-single">
              <div className="panel">
                <div className="panel-header">
                  <h2 className="panel-title">Betalsätt</h2>
                </div>

                <div className="payment-grid">
                  {loadingPaymentOptions ? (
                    <p className="muted">Laddar betalsätt...</p>
                  ) : (
                    <>
                      {paymentOptions.allowOnsite && (
                        <button
                          className={`pay-option ${paymentMethod === "onsite" ? "active" : ""}`}
                          onClick={() => setPaymentMethod("onsite")}
                          type="button"
                        >
                          <div className="pay-title">Betala på plats</div>
                          <div className="pay-desc muted">
                            Markeras som <strong>Obetald</strong> i admin tills
                            personalen tar betalt.
                          </div>
                        </button>
                      )}

                      {paymentOptions.allowOnline && (
                        <button
                          className={`pay-option ${paymentMethod === "online" ? "active" : ""}`}
                          onClick={() => setPaymentMethod("online")}
                          type="button"
                        >
                          <div className="pay-title">Betala direkt</div>
                          <div className="pay-desc muted">
                            Markeras som <strong>Betald</strong>. (Koppla Stripe
                            senare.)
                          </div>
                        </button>
                      )}

                      {!paymentOptions.allowOnsite &&
                        !paymentOptions.allowOnline && (
                          <div className="empty-state">
                            Inga betalsätt är aktiverade för denna workshop.
                            Kontakta företaget.
                          </div>
                        )}
                    </>
                  )}
                </div>

                <div className="summary-footer">
                  <div className="total-row">
                    <span className="muted">Totalt</span>
                    <strong>{calculateTotal()},00 kr</strong>
                  </div>

                  <div className="actions">
                    <button
                      className="btn btn-ghost"
                      onClick={() => setPage(3)}
                    >
                      Tillbaka
                    </button>
                    <button
                      className="btn"
                      onClick={submitBookings}
                      disabled={submittingBooking}
                    >
                      {submittingBooking ? "Skickar..." : "Bekräfta & boka"}
                    </button>
                  </div>

                  <div className="hint">
                    Du får en bokningsbekräftelse på mail när du bokar, väljer
                    du att betala på plats måste du verifiera din bokning via
                    mail för att säkra din bokning.
                  </div>
                </div>
              </div>

              <div className="panel panel-soft">
                <div className="panel-header">
                  <h2 className="panel-title">Kontakt & datum</h2>
                </div>

                <div className="mini-summary">
                  <div>
                    <div className="muted">Namn</div>
                    <strong>{customerName || "-"}</strong>
                  </div>
                  <div>
                    <div className="muted">Mail</div>
                    <strong>{email || "-"}</strong>
                  </div>
                  <div>
                    <div className="muted">Telefon</div>
                    <strong>{phone || "-"}</strong>
                  </div>
                  <div>
                    <div className="muted">Datum</div>
                    <strong>{selectedDate}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="main">
      <Navbar />

      <div className="progress">
        <div className={page === 1 ? "progress_ball_active" : "progress_ball"}>
          <p className={page === 1 ? "progress_txt_active" : "progress_txt"}>
            Välj aktivitet
          </p>
        </div>

        <div className={page === 2 ? "progress_ball_active" : "progress_ball"}>
          <p className={page === 2 ? "progress_txt_active" : "progress_txt"}>
            Välj tid
          </p>
        </div>

        <div className={page === 3 ? "progress_ball_active" : "progress_ball"}>
          <p className={page === 3 ? "progress_txt_active" : "progress_txt"}>
            Ange info
          </p>
        </div>

        <div className={page === 4 ? "progress_ball_active" : "progress_ball"}>
          <p className={page === 4 ? "progress_txt_active" : "progress_txt"}>
            Slutför
          </p>
        </div>
      </div>

      {renderPage()}
    </div>
  );
};

export default Book;
