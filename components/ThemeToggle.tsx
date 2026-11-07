"use client";

import { useEffect, useState } from "react";

// The pre-paint script in app/layout.tsx has already set data-theme on <html>; this reads it back and flips it.
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark");
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // Private mode or blocked storage: the choice just won't persist.
    }
  }

  return (
    <button type="button" role="switch" aria-checked={dark} aria-label="Dark mode" className="theme-toggle" onClick={toggle}>
      <span className="knob" aria-hidden="true">
        {dark ? (
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M21 14.5A9 9 0 0 1 9.5 3 9 9 0 1 0 21 14.5Z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        )}
      </span>
    </button>
  );
}
