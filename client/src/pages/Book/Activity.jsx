import React from "react";
import "./Activity.css";

import { API_BASE_URL } from "../../../config";

const Activity = ({
  title,
  id,
  img,
  info,
  updateBookData,
  bookData,
  nextPage,
  bookingUnit,
  partyRules,
}) => {
  return (
    <div className="main_card">
      <img
        src={img?.startsWith("http") ? img : img ? API_BASE_URL + img : ""}
        alt={title}
      />

      <h3>{title}</h3>
      <div className="card-expand">
        <p className="info">{info}</p>

        {bookingUnit === "per_person" ? (
          <div className="amount">
            <p>Antal personer</p>

            <div className="counter">
              <div
                className="c_button"
                onClick={() => {
                  const minP = Number(partyRules?.min ?? 1);
                  const next = Math.max(
                    minP,
                    Number(bookData.partySize || 1) - 1
                  );
                  updateBookData("partySize", next, id);

                  // ✅ per_person: en bana, så vi vill att man väljer tider (inte "antal banor")
                  // Vi lämnar amount1/amount2 som de är (tider väljs i steg 2).
                }}
              >
                -
              </div>

              <p>{bookData.partySize || Number(partyRules?.min ?? 1)}</p>

              <div
                className="c_button"
                onClick={() => {
                  const maxP = Number(partyRules?.max ?? 99);
                  const next = Math.min(
                    maxP,
                    Number(bookData.partySize || 1) + 1
                  );
                  updateBookData("partySize", next, id);
                }}
              >
                +
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="amount">
              <p>{title} 1 timme</p>
              <div className="counter">
                <div
                  className="c_button"
                  onClick={() => {
                    if (bookData.amount1 > 0) {
                      updateBookData("amount1", bookData.amount1 - 1, id);
                    }
                  }}
                >
                  -
                </div>
                <p>{bookData.amount1}</p>
                <div
                  className="c_button"
                  onClick={() =>
                    updateBookData("amount1", bookData.amount1 + 1, id)
                  }
                >
                  +
                </div>
              </div>
            </div>

            <div className="amount">
              <p>{title} 2 timmar</p>
              <div className="counter">
                <div
                  className="c_button"
                  onClick={() => {
                    if (bookData.amount2 > 0) {
                      updateBookData("amount2", bookData.amount2 - 1, id);
                    }
                  }}
                >
                  -
                </div>
                <p>{bookData.amount2}</p>
                <div
                  className="c_button"
                  onClick={() =>
                    updateBookData("amount2", bookData.amount2 + 1, id)
                  }
                >
                  +
                </div>
              </div>
            </div>
          </>
        )}

        <button onClick={nextPage} className="next">
          Nästa
        </button>
      </div>
    </div>
  );
};

export default Activity;
