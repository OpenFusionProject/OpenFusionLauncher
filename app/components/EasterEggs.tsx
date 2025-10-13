"use client";

import { useEffect, useRef } from "react";
import Snowflakes from "magic-snowflakes";

export default function EasterEggs() {
  const snowflakesRef = useRef<Snowflakes>(null);

  useEffect(() => {
    const initEasterEggs = async () => {
      const today = new Date();
      const christmasBegin = new Date(today.getFullYear(), 11, 21);
      const christmasEnd = new Date(today.getFullYear(), 11, 31);

      if (today >= christmasBegin && today <= christmasEnd) {
        try {
          snowflakesRef.current = new Snowflakes({ zIndex: -100 });
          console.log("Christmas Activated.");
          snowflakesRef.current.start();
        } catch (error) {
          console.warn("Failed to load snowflakes:", error);
        }
      }
    };

    initEasterEggs();

    // Cleanup function
    return () => {
      if (snowflakesRef.current) {
        snowflakesRef.current.stop();
        snowflakesRef.current.destroy();
        snowflakesRef.current = null;
      }
    };
  }, []);

  return null; // This component doesn't render anything visible
}