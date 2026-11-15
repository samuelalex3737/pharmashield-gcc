"use client";

import { useEffect, useState } from "react";

// Tracks whether the dark class is on <html>, so charts can match the theme.
export function useIsDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const update = () => setDark(el.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

export function toggleTheme() {
  const el = document.documentElement;
  const next = !el.classList.contains("dark");
  el.classList.toggle("dark", next);
  try {
    window.localStorage.setItem("pharmashield_theme", next ? "dark" : "light");
  } catch {
    // storage blocked: the theme still applies for this page view
  }
}

// Respects prefers-reduced-motion for Framer Motion animations.
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

// Reads a query-string parameter once on the client (avoids a Suspense boundary for static pages).
export function useQueryParam(name: string): string | null {
  const [value, setValue] = useState<string | null>(null);
  useEffect(() => {
    setValue(new URLSearchParams(window.location.search).get(name));
  }, [name]);
  return value;
}

export const THEME_INIT = `(function(){try{var t=localStorage.getItem('pharmashield_theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;
