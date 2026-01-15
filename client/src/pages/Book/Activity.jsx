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
                  const current = Number(bookData.partySize ?? 0);

                  // 0 => inget att ta bort
                  if (current === 0) return;

                  // om vi är på min (eller under pga edgecase) => tillbaka till 0 (då tas aktiviteten bort)
                  const next = current <= minP ? 0 : current - 1;
                  updateBookData("partySize", next, id);
                }}
              >
                -
              </div>

              <p>{Number(bookData.partySize ?? 0)}</p>

              <div
                className="c_button"
                onClick={() => {
                  const minP = Number(partyRules?.min ?? 1);
                  const maxP = Number(partyRules?.max ?? 99);
                  const current = Number(bookData.partySize ?? 0);

                  // 0 -> hoppa direkt till min (så man slipper klicka 6 gånger)
                  const next =
                    current === 0 ? minP : Math.min(maxP, current + 1);
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
