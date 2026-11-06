"use client";

import type { MouseEvent, ReactNode } from "react";

/**
 * The hero's "Build an app" link. On a phone the examples and the idea box fill the first screen of the stage, so
 * landing on #demo would leave the drawing (and the example that autoplays when it comes into view) below the fold.
 * There it scrolls to the drawing instead. It stays a real link, so Cmd/Ctrl-click and no-JS still go to #demo.
 */
export default function DemoLink({ className, children }: { className?: string; children: ReactNode }) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!window.matchMedia("(max-width: 900px)").matches) return;
    const drawing = document.getElementById("demo-drawing");
    if (!drawing) return;
    e.preventDefault();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    drawing.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", "#demo");
  };
  return (
    <a className={className} href="#demo" onClick={onClick}>
      {children}
    </a>
  );
}
