import React, { useEffect, useMemo, useState } from "react";
import "./Book.css";
import Navbar from "../../components/navbar/Navbar";
import Activity from "./Activity";
import axios from "axios";
import { toast } from "react-hot-toast";
import { API_BASE_URL } from "../../../config";

axios.defaults.baseURL = API_BASE_URL;
axios.defaults.withCredentials = true;

const pad2 = (n) => String(n).padStart(2, "0");
const toISODate = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const addDaysISO = (dateISO, days) => {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return toISODate(dt);
};

const overlaps = (aStartISO, aSlots, bStartISO, bSlots, slotMinutes) => {
  const aStart = new Date(aStartISO).getTime();
  const bStart = new Date(bStartISO).getTime();
  const aEnd = aStart + aSlots * slotMinutes * 60_000;
  const bEnd = bStart + bSlots * slotMinutes * 60_000;
  return aStart < bEnd && bStart < aEnd;
};

const Home = () => {
  const [page, setpage] = useState(1);

  const [selectedDate, setSelectedDate] = useState(() => toISODate(new Date()));

  // workshopId måste komma från någon “tenant”-källa.
  // Exempel: spara den när man väljer företag på startsidan
  const [workshopId] = useState(() => {
    try {
      return localStorage.getItem("selectedWorkshopId") || "";
    } catch {
      return "";
    }
  });

  // activities från API
  const [activities, setActivities] = useState([]);
  const [loadingActs, setLoadingActs] = useState(false);

  // cart: { activityId, amount1, amount2, selections: [{startISO, durationSlots}] }
  const [bookData, setbookData] = useState(() => {
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

  // -----------------------------------
  // Load activities
  // -----------------------------------
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
        id: a.id,
        title: a.title,
        info: a.information,
        img: a.imageUrl,
        tracks: a.tracks,
        bookingRules: a.bookingRules,
        pricePerSlot: a.pricePerSlot || 0,
      }));

      setActivities(mapped);
    } catch (e) {
      toast.error("Kunde inte hämta aktiviteter");
      setActivities([]);
    } finally {
      setLoadingActs(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, [workshopId]);

  // -----------------------------------
  // Cart helpers (din gamla logik + selections)
  // -----------------------------------
  const updateBookData = (field, value, activityId) => {
    const existingIndex = bookData.findIndex(
      (b) => b.activityId === activityId
    );

    if (existingIndex !== -1) {
      const updated = [...bookData];
      const current = updated[existingIndex];

      const nextObj = { ...current, [field]: value };

      const need = (nextObj.amount1 || 0) + (nextObj.amount2 || 0);
      nextObj.selections = (nextObj.selections || []).slice(0, need);

      if ((nextObj.amount1 || 0) === 0 && (nextObj.amount2 || 0) === 0) {
        setbookData(updated.filter((_, idx) => idx !== existingIndex));
      } else {
        updated[existingIndex] = nextObj;
        setbookData(updated);
      }
    } else {
      if (value > 0) {
        setbookData([
          ...bookData,
          {
            activityId,
            amount1: field === "amount1" ? value : 0,
            amount2: field === "amount2" ? value : 0,
            selections: [],
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
      }
    );
  };

  const nextPage = () => {
    if (page === 1) {
      if (bookData.length !== 0) setpage(2);
      return;
    }

    if (page === 2) {
      const allOk = bookData.every((b) => {
        const need = (b.amount1 || 0) + (b.amount2 || 0);
        return (b.selections || []).length === need;
      });

      if (bookData.length !== 0 && allOk) setpage(3);
      else toast.error("Välj alla tider innan du går vidare");
      return;
    }
  };

  const calculateTotal = () => {
    return bookData.reduce((total, booking) => {
      const activity = activities.find((act) => act.id === booking.activityId);
      if (!activity) return total;

      const selections = booking.selections || [];
      const sum = selections.reduce(
        (acc, sel) => acc + sel.durationSlots * (activity.pricePerSlot || 0),
        0
      );
      return total + sum;
    }, 0);
  };

  // -----------------------------------
  // Availability (API) för valt datum
  // -----------------------------------
  const [availabilityMap, setAvailabilityMap] = useState({}); // activityId -> {slotMinutes, slots[]}
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

      const from = selectedDate;
      const to = addDaysISO(selectedDate, 1);

      const results = await Promise.all(
        uniqueIds.map(async (id) => {
          const res = await axios.get(
            `/activity/${id}/availability?from=${from}&to=${to}`
          );
          return [id, res.data];
        })
      );

      const next = {};
      for (const [id, data] of results) {
        next[id] = data;
      }
      setAvailabilityMap(next);
    } catch (e) {
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
  }, [page, selectedDate, selectedActivityIdsKey]);

  // -----------------------------------
  // Picking slots (frontend-logik baserat på availableTracks)
  // -----------------------------------
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
        slotMinutes
      );
      const effectiveAvailable = Math.max(
        0,
        (slot.availableTracks || 0) - usedInCart
      );

      if (effectiveAvailable <= 0) return false;
    }

    return true;
  };

  const pickTime = (activityId, startISO, durationSlots) => {
    setbookData((prev) =>
      prev.map((b) => {
        if (b.activityId !== activityId) return b;

        const av = availabilityMap[activityId];
        const slotMinutes = av?.slotMinutes || 60;

        const need = (b.amount1 || 0) + (b.amount2 || 0);
        const selections = b.selections || [];

        if (selections.length >= need) return b;

        const overlapsExisting = selections.some((sel) =>
          overlaps(
            sel.startISO,
            sel.durationSlots,
            startISO,
            durationSlots,
            slotMinutes
          )
        );
        if (overlapsExisting) return b;

        return {
          ...b,
          selections: [...selections, { startISO, durationSlots }],
        };
      })
    );
  };

  const removeSelection = (activityId, index) => {
    setbookData((prev) =>
      prev.map((b) =>
        b.activityId === activityId
          ? {
              ...b,
              selections: (b.selections || []).filter((_, i) => i !== index),
            }
          : b
      )
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

  // -----------------------------------
  // FINAL: skapa bokningar i backend
  // -----------------------------------
  const [submittingBooking, setSubmittingBooking] = useState(false);

  const submitBookings = async () => {
    try {
      setSubmittingBooking(true);

      const payload = bookData.flatMap((b) =>
        (b.selections || []).map((sel) => ({
          activityId: b.activityId,
          startISO: sel.startISO,
          durationSlots: sel.durationSlots,
        }))
      );

      if (payload.length === 0) {
        toast.error("Inga tider valda");
        return;
      }

      const results = await Promise.allSettled(
        payload.map((p) => axios.post("/booking/create", p))
      );

      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        toast.error(
          "Minst en bokning misslyckades (någon hann boka före). Uppdatera tider."
        );
        await loadAvailabilityForSelected();
        return;
      }

      toast.success("Bokning klar");
      localStorage.removeItem("bookData");
      setbookData([]);
      setpage(1);
    } catch (e) {
      toast.error("Kunde inte slutföra bokning");
    } finally {
      setSubmittingBooking(false);
    }
  };

  // -----------------------------------
  // UI
  // -----------------------------------
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
                  />
                ))}
              </div>
            )}
          </div>
        );

      case 2: {
        const selected = bookData.filter(
          (b) => (b.amount1 || 0) > 0 || (b.amount2 || 0) > 0
        );

        const canGoNext =
          bookData.length !== 0 &&
          bookData.every((b) => {
            const need = (b.amount1 || 0) + (b.amount2 || 0);
            return (b.selections || []).length === need;
          });

        return (
          <div className="content booking-page">
            <div className="booking-header">
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
              <div>
                <h1 className="booking-title">Välj tid</h1>
                <p className="booking-subtitle">
                  Välj tider för de aktiviteter du har lagt i din bokning. Varje
                  “slot” är en tid du kan boka. 2 timmar kräver två slots i rad.
                </p>
              </div>
            </div>

            <div className="booking-grid">
              {/* LEFT: välj tider */}
              <div className="panel">
                <div className="panel-header">
                  <h2 className="panel-title">Lediga tider</h2>

                  <div className="legend">
                    <div className="legend-item">
                      <span className="dot dot-green" />
                      <span>Ledigt</span>
                    </div>
                    <div className="legend-item">
                      <span className="dot dot-yellow" />
                      <span>Få kvar</span>
                    </div>
                    <div className="legend-item">
                      <span className="dot dot-red" />
                      <span>Fullt</span>
                    </div>
                  </div>
                </div>

                <div className="helper-card">
                  <div className="helper-row">
                    <div className="helper-title">Vad betyder “tracks”?</div>
                    <div className="helper-text">
                      Tracks är hur många som kan boka samma slot samtidigt
                      (t.ex. antal banor).
                    </div>
                  </div>
                  <div className="helper-row">
                    <div className="helper-title">Vad betyder 1h / 2h?</div>
                    <div className="helper-text">
                      1h = en slot. 2h = två slots i rad (t.ex. 14:00 + 15:00).
                    </div>
                  </div>
                </div>

                {loadingAvail ? (
                  <p className="muted">Laddar tider...</p>
                ) : (
                  selected.map((b) => {
                    const activity = activities.find(
                      (a) => a.id === b.activityId
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
                              Kapacitet per slot:{" "}
                              <strong>{activity.tracks}</strong>
                            </p>
                          </div>

                          <div className="need-box">
                            <div className="need-item">
                              <span className="muted">Behöver 1h</span>
                              <strong>{Math.max(0, need1 - sel1)}</strong>
                            </div>
                            <div className="need-item">
                              <span className="muted">Behöver 2h</span>
                              <strong>{Math.max(0, need2 - sel2)}</strong>
                            </div>
                          </div>
                        </div>

                        {slots.length === 0 ? (
                          <div className="empty-state">
                            Inga tider denna dag (stängt eller undantag).
                          </div>
                        ) : (
                          <div className="slots-grid">
                            {slots.map((slot, idx) => {
                              const usedInCart = takenCountInCartForSlot(
                                activity.id,
                                slot.startISO,
                                av?.slotMinutes || 60
                              );

                              const left = Math.max(
                                0,
                                (slot.availableTracks || 0) - usedInCart
                              );

                              const can1 =
                                needMore1 && canPickStart(activity.id, idx, 1);
                              const can2 =
                                needMore2 && canPickStart(activity.id, idx, 2);

                              const timeLabel = new Date(
                                slot.startISO
                              ).toLocaleTimeString("sv-SE", {
                                hour: "2-digit",
                                minute: "2-digit",
                              });

                              const chipClass =
                                left === 0
                                  ? "chip chip-red"
                                  : left === 1
                                  ? "chip chip-yellow"
                                  : "chip chip-green";

                              return (
                                <div
                                  key={slot.startISO}
                                  className={`slot-card ${
                                    left === 0 ? "slot-card-disabled" : ""
                                  }`}
                                >
                                  <div className="slot-top">
                                    <div className="slot-time">{timeLabel}</div>
                                    <div className={chipClass}>
                                      {left === 0 ? "Fullt" : `${left} kvar`}
                                    </div>
                                  </div>

                                  <div className="slot-buttons">
                                    <button
                                      className="btn"
                                      disabled={!can1}
                                      onClick={() =>
                                        pickTime(activity.id, slot.startISO, 1)
                                      }
                                    >
                                      1h
                                    </button>
                                    <button
                                      className="btn btn-secondary"
                                      disabled={!can2}
                                      onClick={() =>
                                        pickTime(activity.id, slot.startISO, 2)
                                      }
                                    >
                                      2h
                                    </button>
                                  </div>

                                  <div className="slot-foot muted">
                                    2h kräver två tider i rad
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* RIGHT: sammanfattning */}
              <div className="panel panel-sticky">
                <div className="panel-header">
                  <h2 className="panel-title">Din bokning</h2>
                  <div
                    className={`status ${
                      canGoNext ? "status-ok" : "status-warn"
                    }`}
                  >
                    {canGoNext ? "Redo att gå vidare" : "Välj alla tider"}
                  </div>
                </div>

                <div className="summary-list">
                  {selected.map((book) => {
                    const activity = activities.find(
                      (a) => a.id === book.activityId
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

                        <div className="summary-metrics">
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
                        </div>

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
                                      }
                                    )}
                                  </div>
                                  <div className="muted">
                                    {sel.durationSlots}h
                                  </div>
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
                      onClick={() => setpage(1)}
                    >
                      Tillbaka
                    </button>
                    <button
                      className="btn"
                      onClick={nextPage}
                      disabled={!canGoNext}
                    >
                      Nästa
                    </button>
                  </div>

                  {!canGoNext && (
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

      case 3:
        return (
          <div className="content">
            <h2>Slutför bokning</h2>
            <p style={{ opacity: 0.8 }}>
              Nu skickas bokningarna till backend. Om någon slot hinner bli full
              så får du fel och kan uppdatera tider.
            </p>

            <pre style={{ width: "80vw", overflow: "auto" }}>
              {JSON.stringify(
                {
                  date: selectedDate,
                  bookings: bookData.flatMap((b) =>
                    (b.selections || []).map((sel) => ({
                      activityId: b.activityId,
                      startISO: sel.startISO,
                      durationSlots: sel.durationSlots,
                    }))
                  ),
                  total: calculateTotal(),
                },
                null,
                2
              )}
            </pre>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setpage(2)}>Tillbaka</button>
              <button onClick={submitBookings} disabled={submittingBooking}>
                {submittingBooking ? "Skickar..." : "Bekräfta & boka"}
              </button>
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

export default Home;
