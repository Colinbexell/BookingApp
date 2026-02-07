import React, { useEffect, useRef, useState } from "react";
import "./Home.css";
import Lenis from "lenis";
import Navbar from "../../components/navbar/Navbar";

import Logo from "../../assets/web/Logo.png";

const Home = () => {
  localStorage.clear();
  const mainRef = useRef(null);
  const lenisRef = useRef(null);

  // Smooth scroll setup with Lenis
  useEffect(() => {
    let rafId;

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      smoothTouch: false,
      // Don't specify wrapper - let it use window/document
    });

    lenisRef.current = lenis;

    const raf = (time) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    // Listen to Lenis scroll events
    lenis.on("scroll", ({ scroll }) => {
      setScrollPos(scroll);
      if (mainRef.current) {
        mainRef.current.style.setProperty("--bg-scroll", `${scroll}px`);
      }
    });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (lenisRef.current) lenisRef.current.destroy();
    };
  }, []);

  return (
    <div className="main" ref={mainRef}>
      <Navbar />
      <div className="display">
        <section>
          <img className="top-logo" src={Logo} alt="" />
          <h4>VÄLKOMMEN</h4>
          <h5 className="top-h5">
            Bowla med vänner och familj i vår toppmoderna bowlinghall. Oavsett
            om du är en erfaren spelare eller nybörjare, erbjuder vi en rolig
            och avslappnad atmosfär för alla. Boka din bana idag och upplev
            spänningen i varje kast!
          </h5>
        </section>
        <section>
          <h4>VÅRA AKTIVITETER</h4>
        </section>
      </div>
    </div>
  );
};

export default Home;
