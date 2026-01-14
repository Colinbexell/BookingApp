import React from "react";
import "./ActivityCard.css";
import { API_BASE_URL } from "../../../../../config";

const ActivityCard = ({ title, imageUrl, tracks, onClick }) => {
  return (
    <div className="act_card" onClick={onClick}>
      <img
        src={imageUrl?.startsWith("http") ? imageUrl : API_BASE_URL + imageUrl}
        alt={title}
      />
      <h3>{title}</h3>
      <p>{tracks} tracks</p>
    </div>
  );
};

export default ActivityCard;
