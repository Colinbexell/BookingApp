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

  const renderPage = () => {
    switch (page) {
      case 1:
        return (
          <div className="content">
            <Activity
              title={"Bowling"}
              img={Bowling}
              path={"test"}
              info={
                "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially"
              }
            />
            <Activity
              title={"Curling"}
              img={Curling}
              path={"test"}
              info={
                "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially"
              }
            />
            <Activity
              title={"Dart"}
              img={Dart}
              path={"test"}
              info={
                "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially"
              }
            />
            <Activity
              title={"Pool"}
              img={Pool}
              path={"test"}
              info={
                "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially"
              }
            />
            <Activity
              title={"Pingpong"}
              img={Pingpong}
              path={"test"}
              info={
                "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially"
              }
            />
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
