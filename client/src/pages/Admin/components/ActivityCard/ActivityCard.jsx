import React from "react";
import "./ActivityCard.css";

const ActivityCard = ({ title, imageUrl, tracks }) => {
  return (
    <div className="act_card">
      <img src={imageUrl} alt={title} />
      <h3>{title}</h3>
      <p>{tracks} tracks</p>
    </div>
  );
};

export default ActivityCard;
