import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import "./Admin.css";

import Sidebar from "./components/Sidebar/Sidebar";
import ActivityCard from "./components/ActivityCard/ActivityCard";

import Plus from "../../assets/Plus_white.png";
import { API_BASE_URL } from "../../../config";

axios.defaults.baseURL = API_BASE_URL;
axios.defaults.withCredentials = true;

const dayNames = ["Sön", "Mån", "Tis", "Ons", "Tor", "Fre", "Lör"];

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

  // Filter för bokningar
  const [fromDate, setFromDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [toDate, setToDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [bookingSearch, setBookingSearch] = useState("");

  // Avboknings Popup
  const [cancelPopupOpen, setCancelPopupOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null); // booking-raden
  const [isCancelling, setIsCancelling] = useState(false);

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
          act.useWorkshopAvailability !== "false"
      );

      setSlotMinutes(act.bookingRules?.slotMinutes || 60);
      setMinSlots(act.bookingRules?.minSlots || 1);
      setMaxSlots(act.bookingRules?.maxSlots || 2);

      setDefaultPricePerHour(act.pricingRules?.defaultPricePerHour ?? 279);
      setWeeklyPricing(
        act.pricingRules?.weekly?.length
          ? act.pricingRules.weekly
          : emptyWeeklyPricing()
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
          : d
      )
    );
  };

  const updatePriceRange = (day, idx, patch) => {
    setWeeklyPricing((prev) =>
      prev.map((d) =>
        d.day === day
          ? {
              ...d,
              ranges: d.ranges.map((r, i) =>
                i === idx ? { ...r, ...patch } : r
              ),
            }
          : d
      )
    );
  };

  const removePriceRange = (day, idx) => {
    setWeeklyPricing((prev) =>
      prev.map((d) =>
        d.day === day
          ? { ...d, ranges: d.ranges.filter((_, i) => i !== idx) }
          : d
      )
    );
  };

  // Avboka en bokning
  const cancelBookingRow = (b) => {
    if (b.status !== "active") return;
    setCancelTarget(b);
    setCancelPopupOpen(true);
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

  // --- Load bookings (workshop) ---
  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  const loadBookings = async () => {
    if (!workshopId) return;

    try {
      const res = await axios.get(
        `/booking/workshop/${workshopId}?from=${fromDate}&to=${toDate}`
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

  useEffect(() => {
    if (!canUseAdmin) return;
    loadActivities();
  }, [canUseAdmin]);

  useEffect(() => {
    if (!canUseAdmin) return;

    if (page === 1) loadBookings();
    if (page === 2) loadActivities();
    if (page === 3) loadWorkshopAvailability();
  }, [page, canUseAdmin]);

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
      prev.map((e, i) => (i === idx ? { ...e, ...patch } : e))
    );
  };

  const removeException = (idx) => {
    setExceptions((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateWeekly = (idx, patch) => {
    setWeekly((prev) =>
      prev.map((w, i) => (i === idx ? { ...w, ...patch } : w))
    );
  };

  const filteredBookings = useMemo(() => {
    const q = bookingSearch.trim().toLowerCase();
    if (!q) return bookings;

    return bookings.filter((b) => {
      return (
        (b.customerName || "").toLowerCase().includes(q) ||
        (b.email || "").toLowerCase().includes(q) ||
        (b.phone || "").toLowerCase().includes(q)
      );
    });
  }, [bookings, bookingSearch]);

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
                <input
                  className="booking-search"
                  type="text"
                  placeholder="Sök namn, mail eller telefon…"
                  value={bookingSearch}
                  onChange={(e) => setBookingSearch(e.target.value)}
                />
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
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
                <div>Åtgärd</div>
              </div>

              {bookings.length === 0 ? (
                <div className="empty-state">
                  Inga bokningar i valt intervall.
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
                    })
                  );

                  const end = new Date(b.endAt).toLocaleTimeString("sv-SE", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  const paymentLabel =
                    b.paymentStatus === "paid"
                      ? "Betald"
                      : b.paymentMethod === "onsite"
                      ? "Obetald (på plats)"
                      : "Obetald";

                  return (
                    <div key={b.id} className="bookings-row">
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
                      <div className="booking-actions">
                        <button
                          className="admin-btn danger small"
                          onClick={() => cancelBookingRow(b)}
                          disabled={b.status !== "active"}
                          title="Avboka"
                        >
                          Avboka
                        </button>
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
                                prev.filter((x) => x.day !== day)
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
