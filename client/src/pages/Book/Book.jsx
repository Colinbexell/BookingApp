import React, { useEffect, useRef, useState } from "react";
import "./Book.css";
import Lenis from "lenis";
import Navbar from "../../components/navbar/Navbar";
import Activity from "./Activity";

import Bowling from "../../assets/Bowling.jpg";
import Curling from "../../assets/Curling.jpg";
import Dart from "../../assets/Dart.jpg";
import Pingpong from "../../assets/Pingpong.png";
import Pool from "../../assets/Pool.jpg";

const Home = () => {
  const [page, setpage] = useState(1);
  const [bookData, setbookData] = useState(() => {
    try {
      const saved = localStorage.getItem("bookData");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activities, setactivities] = useState([
    {
      title: "Bowling",
      id: "bowling",
      img: Bowling,
      info: "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy ",
      cost: 349,
    },
    {
      title: "Curling",
      id: "curling",
      img: Curling,
      info: "Lorem Ipsum is simply dummy text of the printing and typesetting industry.",
      cost: 129,
    },
    {
      title: "Dart",
      id: "dart",
      img: Dart,
      info: "Lorem Ipsum is simply dummy text of the printing and typesetting industry.",
      cost: 99,
    },
  ]);

  // Checkers
  useEffect(() => {
    console.log("bookData uppdaterad:", bookData);
    localStorage.setItem("bookData", JSON.stringify(bookData));
  }, [bookData]);

  const nextPage = () => {
    switch (page) {
      case 1:
        if (bookData.length !== 0) {
          setpage(page + 1);
        }
        break;

      default:
        break;
    }
    console.log(bookData);
  };

  const updateBookData = (field, value, activityId) => {
    const existingIndex = bookData.findIndex(
      (book) => book.activityId === activityId
    );

    if (existingIndex !== -1) {
      // Aktiviteten finns - uppdatera den
      const updatedBookData = [...bookData];
      updatedBookData[existingIndex] = {
        ...updatedBookData[existingIndex],
        [field]: value,
      };

      // Ta bort aktiviteten om båda är 0
      if (
        updatedBookData[existingIndex].amount1 === 0 &&
        updatedBookData[existingIndex].amount2 === 0
      ) {
        // Filtrera bort aktiviteten
        setbookData(
          updatedBookData.filter((_, index) => index !== existingIndex)
        );
      } else {
        // Annars uppdatera normalt
        setbookData(updatedBookData);
      }
    } else {
      // Aktiviteten finns inte - lägg till ny (bara om value > 0)
      if (value > 0) {
        setbookData([
          ...bookData,
          {
            activityId: activityId,
            amount1: field === "amount1" ? value : 0,
            amount2: field === "amount2" ? value : 0,
          },
        ]);
      }
    }
  };

  // Hjälpfunktion för att hämta data för en specifik aktivitet
  const getActivityBookData = (activityId) => {
    return (
      bookData.find((book) => book.activityId === activityId) || {
        activityId: activityId,
        amount1: 0,
        amount2: 0,
      }
    );
  };

  // Funktion för att beräkna totalpriset
  const calculateTotal = () => {
    return bookData.reduce((total, booking) => {
      const activity = activities.find((act) => act.id === booking.activityId);

      if (!activity) return total;

      return (
        total +
        booking.amount1 * activity.cost +
        booking.amount2 * activity.cost * 2
      );
    }, 0);
  };

  const renderPage = () => {
    switch (page) {
      case 1:
        return (
          <div className="content">
            {activities.map((act) => (
              <Activity
                key={act.id}
                title={act.title}
                id={act.id}
                img={act.img}
                info={act.info}
                cost={act.cost}
                updateBookData={updateBookData}
                nextPage={nextPage}
                bookData={getActivityBookData(act.id)}
              />
            ))}
          </div>
        );
      case 2:
        return (
          <div className="content">
            <h3>Beställningsöversikt</h3>
            <div className="booking-summary">
              {bookData
                .filter((book) => book.amount1 > 0 || book.amount2 > 0)
                .map((book) => {
                  const activity = activities.find(
                    (act) => act.id === book.activityId
                  );
                  if (!activity) return null;

                  return (
                    <div key={book.activityId} className="summary-item">
                      <h3>{activity.title}</h3>
                      {book.amount1 > 0 && (
                        <div>
                          <p>
                            {book.amount1}x {activity.title} 1 timme:
                          </p>
                          <p>
                            <strong>
                              {book.amount1 * activity.cost},00 kr
                            </strong>
                          </p>
                        </div>
                      )}
                      {book.amount2 > 0 && (
                        <div>
                          <p>
                            {book.amount2}x {activity.title} 2 timmar:
                          </p>
                          <p>
                            <strong>
                              {book.amount2 * activity.cost * 2},00 kr
                            </strong>
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              <p>
                <strong>Totalt: {calculateTotal()},00 kr</strong>
              </p>
            </div>

            {bookData.filter((book) => book.amount1 > 0 || book.amount2 > 0)
              .length === 0 && <p>Ingen aktivitet vald ännu.</p>}

            <div className="buttons">
              <button onClick={() => setpage(1)}>Tillbaka</button>
              <button onClick={() => setpage(3)}>Nästa</button>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="content">
            <h2>Slutför bokning</h2>
            <pre>{JSON.stringify(bookData, null, 2)}</pre>
            <button onClick={() => setpage(1)}>Börja om</button>
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
