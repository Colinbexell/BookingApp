import React, { useEffect, useState } from "react";
import "./Navbar.css";
import MenuIcon from "../../assets/MenuIcon.png";

const Navbar = () => {
  const [menuActive, setmenuActive] = useState(false);

  useEffect(() => {
    const navbar = document.querySelector(".nav");

    const onScroll = () => {
      if (window.scrollY > 10) {
        navbar.classList.add("scrolled");
      } else {
        navbar.classList.remove("scrolled");
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="nav">
      <div className="logo">
        <img src="" alt="" />
      </div>
      <div className="nav_buttons">
        <a href="/book">Boka</a>
        <a href="#s1">Section 1</a>
        <a href="#s2">Section 2</a>
        <a href="#s3">Section 3</a>
        <a href="#s4">Section 4</a>
      </div>

      <div className="nav_mobile">
        <button
          className="menu_btn"
          onClick={() => {
            setmenuActive(!menuActive);
          }}
        >
          <img src={MenuIcon} alt="" />
        </button>
      </div>

      <div
        className={menuActive ? "menu_bg_active" : "menu_bg"}
        onClick={() => setmenuActive(false)}
      >
        <div
          className={menuActive ? "menu_active" : "menu"}
          onClick={(e) => e.stopPropagation()}
        >
          <a href="/book" onClick={() => setmenuActive(false)}>
            Boka
          </a>
          <a href="#s1" onClick={() => setmenuActive(false)}>
            Section 1
          </a>
          <a href="#s2" onClick={() => setmenuActive(false)}>
            Section 2
          </a>
          <a href="#s3" onClick={() => setmenuActive(false)}>
            Section 3
          </a>
          <a href="#s4" onClick={() => setmenuActive(false)}>
            Section 4
          </a>
        </div>
      </div>
    </div>
  );
};

export default Navbar;
