import React, { useEffect, useState } from "react";
import "./Navbar.css";
import MenuIcon from "../../assets/MenuIcon.png";

import Logo from "../../assets/web/Logo.png";

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
      <a className="logo" href="/">
        <img src={Logo} alt="Logo" />
      </a>
      <div className="nav_buttons">
        <a href="/book">Boka</a>
        <a href="#s2">Öppettider</a>
        <a href="#s3">Kontakt</a>
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
          <a href="/book">Boka</a>
          <a href="#s2">Öppettider</a>
          <a href="#s3">Kontakt</a>
        </div>
      </div>
    </div>
  );
};

export default Navbar;
