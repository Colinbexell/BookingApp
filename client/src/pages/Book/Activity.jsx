import React from "react";
import "./Activity.css";

import { API_BASE_URL } from "../../../config";

const Activity = ({
  title,
  id,
  img,
  info,
  cost,
  updateBookData,
  bookData,
  nextPage,
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

        <div className="amount">
          <p>{title} 1 timme</p>
          {/* <p className="cost">{cost},00 kr</p> */}
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
          {/* <p className="cost">{cost * 2},00 kr</p> */}
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

        <button onClick={nextPage} className="next">
          Nästa
        </button>
      </div>
    </div>
  );
};

export default Activity;
