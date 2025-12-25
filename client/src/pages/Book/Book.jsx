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
  const [bookData, setbookData] = useState({
    activityId: null,
    amount1: 0,
    amount2: 0,
  });

  const [activities, setactivities] = useState([
    {
      title: "Bowling",
      id: "bowling",
      img: Bowling,
      info: "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy ",
      cost: 349,
    },
  ]);

  const updateBookData = (field, value, id) => {
    setbookData({
      ...bookData,
      [field]: value,
      activityId: id,
    });
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
                setpage={setpage}
                bookData={bookData}
              />
            ))}
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
