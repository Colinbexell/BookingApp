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

  // Popup skapa aktivitet
  const [newActPopupVisible, setNewActPopupVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ny aktivitet form
  const [title, setTitle] = useState("");
  const [information, setInformation] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [tracks, setTracks] = useState(2);
  const [useWorkshopAvailability, setUseWorkshopAvailability] = useState(true);
  const [slotMinutes, setSlotMinutes] = useState(60);
  const [minSlots, setMinSlots] = useState(1);
  const [maxSlots, setMaxSlots] = useState(2);

  const canUseAdmin = useMemo(() => !!workshopId, [workshopId]);

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
  const loadBookings = async () => {
    if (!workshopId) return;
    try {
      const res = await axios.get(
        `/booking/workshop/${workshopId}?from=${fromDate}&to=${toDate}`
      );
      setBookings(res.data.bookings || []);
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

      await axios.post("/activity/create", {
        title,
        information,
        imageUrl,
        tracks: Number(tracks),
        workshopId,
        bookingRules: {
          slotMinutes: Number(slotMinutes),
          minSlots: Number(minSlots),
          maxSlots: Number(maxSlots),
        },
        useWorkshopAvailability,
        // om du vill ha activity-specific availability senare:
        // availability: useWorkshopAvailability ? undefined : { weekly: [...], exceptions:[...] }
      });

      toast.success("Aktivitet skapad ✅");
      setNewActPopupVisible(false);

      // reset form
      setTitle("");
      setInformation("");
      setImageUrl("");
      setTracks(2);
      setUseWorkshopAvailability(true);
      setSlotMinutes(60);
      setMinSlots(1);
      setMaxSlots(2);

      loadActivities();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Kunde inte skapa aktivitet");
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

  console.log("userData:", user);
  console.log("workshopId vi använder:", workshopId);

  // --- UI pages ---
  const renderBookings = () => {
    return (
      <div className="admin-content">
        <div className="admin-inner">
          <div className="admin-card">
            <div className="bookings-head">
              <div>
                <h3 style={{ margin: 0 }}>Bokningar</h3>
                <p className="admin-muted" style={{ margin: "6px 0 0 0" }}>
                  Kunden säger namn + tid. Matcha snabbt i listan.
                </p>
              </div>

              <div className="bookings-controls">
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
                <div>Status</div>
              </div>

              {bookings.length === 0 ? (
                <div className="empty-state">
                  Inga bokningar i valt intervall.
                </div>
              ) : (
                bookings.map((b) => {
                  const start = new Date(b.startAt).toLocaleString("sv-SE", {
                    weekday: "short",
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  const end = new Date(b.endAt).toLocaleTimeString("sv-SE", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div key={b.id} className="bookings-row">
                      <div className="booking-name">
                        <strong>{b.customerName}</strong>
                      </div>

                      <div className="booking-activity">{b.activityTitle}</div>

                      <div className="booking-time">
                        <strong>{start}</strong>
                        <span className="muted">– {end}</span>
                      </div>

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
                onClick={() => setNewActPopupVisible(true)}
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

            <div className="new-act-input">
              <h3 className="new-act-h3">Bild URL</h3>
              <input
                type="text"
                className="normal-input"
                placeholder="/uploads/bowling.jpg eller https://..."
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
            </div>

            <div
              className="admin-row"
              style={{ width: "50%", gap: 12, marginTop: 12 }}
            >
              <div className="admin-field" style={{ flex: 1 }}>
                <p>Tracks</p>
                <input
                  type="number"
                  min="1"
                  value={tracks}
                  onChange={(e) => setTracks(e.target.value)}
                />
              </div>

              <div className="admin-field" style={{ flex: 1 }}>
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

            <div
              className="admin-row"
              style={{ width: "50%", gap: 12, marginTop: 12 }}
            >
              <div className="admin-field" style={{ flex: 1 }}>
                <p>Min timmar</p>
                <input
                  type="number"
                  min="1"
                  max="2"
                  value={minSlots}
                  onChange={(e) => setMinSlots(e.target.value)}
                />
              </div>

              <div className="admin-field" style={{ flex: 1 }}>
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

            <div className="admin-row" style={{ width: "50%", marginTop: 14 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="checkbox"
                  checked={useWorkshopAvailability}
                  onChange={(e) => setUseWorkshopAvailability(e.target.checked)}
                />
                Använd workshopens öppettider (rekommenderas)
              </label>
            </div>

            <div
              className="admin-row"
              style={{ width: "50%", marginTop: 16, gap: 10 }}
            >
              <button
                className="admin-btn"
                onClick={submitActivity}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Skapar..." : "Skapa aktivitet"}
              </button>
              <button
                className="admin-btn danger"
                onClick={() => setNewActPopupVisible(false)}
              >
                Avbryt
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Admin;
