import React from "react";
import "./Navbar.css";

const Navbar = () => {
  return (
    <div className="nav">
      <div className="logo">
        <img src="" alt="" />
      </div>
      <div className="nav_buttons">
        <a href="#s1">Section 1</a>
        <a href="#s2">Section 2</a>
        <a href="#s3">Section 3</a>
        <a href="#s4">Section 4</a>
        <a href="/book">Boka</a>
      </div>
    </div>
  );
};

export default Navbar;
