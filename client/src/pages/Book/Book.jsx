import React, { useEffect, useRef, useState } from "react";
import "./Book.css";
import Lenis from "lenis";
import Navbar from "../../components/navbar/Navbar";
import Activity from "./Activity";
import Bowling from "../../assets/Bowling.jpg";

const Home = () => {
  const [page, setpage] = useState(1);

  const renderPage = () => {
    switch (page) {
      case 1:
        return (
          <div className="content">
            <Activity title={"Bowling"} img={Bowling} path={"test"} />
          </div>
        );
      case 2:
        return <div className="content"></div>;
      case 3:
        return <div className="content"></div>;
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
            Ange info
          </p>
        </div>
        <div className={page === 3 ? "progress_ball_active" : "progress_ball"}>
          <p className={page === 3 ? "progress_txt_active" : "progress_txt"}>
            Slutför
          </p>
        </div>
      </div>
      {renderPage()}
    </div>
  );
};

export default Home;
