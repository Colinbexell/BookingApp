import React, { useEffect, useRef, useState } from "react";
import "./Home.css";
import Lenis from "lenis";
import Navbar from "../../components/navbar/Navbar";

const Home = () => {
  return (
    <div className="main" ref={mainRef}>
      <Navbar />
    </div>
  );
};

export default Home;
