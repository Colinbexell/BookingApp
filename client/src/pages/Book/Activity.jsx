import React from "react";
import "./Activity.css";

const Activity = ({ title, img, info }) => {
  return (
    <div className="main_card">
      <img src={img} alt="" />
      <h3>{title}</h3>
      <p className="info">{info}</p>
    </div>
  );
};

export default Activity;
