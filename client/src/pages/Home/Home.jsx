import React, { useEffect, useRef, useState } from "react";
import "./Home.css";
import Lenis from "lenis";
import Navbar from "../../components/navbar/Navbar";

const Home = () => {
  const mainRef = useRef(null);
  const s1 = useRef(null);
  const s2 = useRef(null);
  const s3 = useRef(null);
  const s4 = useRef(null);
  const lenisRef = useRef(null);
  const [scrollPos, setScrollPos] = useState(0);

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

  // Background color change based on scroll position
  useEffect(() => {
    const sections = [
      { el: s1.current, bg: "#473BF0", secondary: "#443accff" },
      { el: s2.current, bg: "#ebebebff", secondary: "#d9d9d9ff" },
      { el: s3.current, bg: "#22333B", secondary: "#1e2d34ff" },
      { el: s4.current, bg: "#211A1E", secondary: "#2a2126ff" },
    ].filter((s) => s.el);

    if (!mainRef.current || sections.length === 0) return;

    let currentIndex = -1;

    const update = () => {
      // Use window for viewport
      const viewportMidY = window.innerHeight / 2;

      let bestIndex = 0;
      let bestDist = Infinity;

      for (let i = 0; i < sections.length; i++) {
        const rect = sections[i].el.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const dist = Math.abs(midY - viewportMidY);

        if (dist < bestDist) {
          bestDist = dist;
          bestIndex = i;
        }
      }

      if (bestIndex !== currentIndex) {
        currentIndex = bestIndex;
        document.documentElement.style.setProperty(
          "--background",
          sections[bestIndex].bg
        );
        document.documentElement.style.setProperty(
          "--background-secondary",
          sections[bestIndex].secondary
        );
        document.documentElement.style.setProperty("--dot-brightness", "1.15");

        setTimeout(() => {
          document.documentElement.style.setProperty("--dot-brightness", "1");
        }, 100);
      }
    };

    // Initial update
    update();

    // Update on scroll position change
    update();
  }, [scrollPos]);

  return (
    <div className="main" ref={mainRef}>
      <Navbar />
      <div className="section" ref={s1}>
        <h1>Section 1</h1>
        <p>
          Welcome to the first section. Scroll down to see the smooth
          transitions.
        </p>
      </div>

      <div className="section" ref={s2}>
        <h1>Section 2</h1>
        <p>
          This section has a light background with smooth color transitions.
        </p>
      </div>

      <div className="section" ref={s3}>
        <h1>Section 3</h1>
        <p>A vibrant yellow section. The dot pattern moves with your scroll.</p>
      </div>

      <div className="section" ref={s4}>
        <h1>Section 4</h1>
        <p>
          The final section with a dark elegant background. Thanks for
          scrolling!
        </p>
      </div>
    </div>
  );
};

export default Home;
