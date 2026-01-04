import React from "react";
import "./Sidebar.css";

import ActivityIcon from "../../../../assets/Activity_black.png";
import BookingIcon from "../../../../assets/Check_black.png";
import CalendarIcon from "../../../../assets/Settings.png";
import UserIcon from "../../../../assets/User.png";
import SettingsIcon from "../../../../assets/Settings.png";

const Sidebar = ({ page, setpage }) => {
  return (
    <div className="sidebar-main">
      <div>
        <div className="sidebar-top">
          <h2 className="sidebar-title">Admin</h2>
          <p className="sidebar-subtitle">Hantera bokningar & öppettider</p>
        </div>

        <div className="sidebar-nav">
          <div
            className={`side-button ${page === 1 ? "active" : ""}`}
            onClick={() => setpage(1)}
          >
            <img src={BookingIcon} alt="" className="side-icon" />
            <h3 className="side-button-txt">Bokningar</h3>
          </div>

          <div
            className={`side-button ${page === 2 ? "active" : ""}`}
            onClick={() => setpage(2)}
          >
            <img src={ActivityIcon} alt="" className="side-icon" />
            <h3 className="side-button-txt">Aktiviteter</h3>
          </div>

          <div
            className={`side-button ${page === 3 ? "active" : ""}`}
            onClick={() => setpage(3)}
          >
            <img src={CalendarIcon} alt="" className="side-icon" />
            <h3 className="side-button-txt">Kalender</h3>
          </div>
        </div>
      </div>

      <div className="sidebar-bottom">
        <div className="bottom-button">
          <img src={UserIcon} alt="" />
        </div>
        <div className="bottom-button">
          <img src={SettingsIcon} alt="" />
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
