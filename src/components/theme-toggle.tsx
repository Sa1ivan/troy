"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { themeKey, type Theme } from "@/lib/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    function sync() {
      let saved: string | null = null;
      try { saved = localStorage.getItem(themeKey); } catch {}
      const next = saved === "light" || saved === "dark" ? saved : media.matches ? "dark" : "light";
      document.documentElement.dataset.theme = next;
      setTheme(next);
    }
    function syncStorage(event: StorageEvent) {
      if (event.key === themeKey || event.key === null) sync();
    }
    sync();
    media.addEventListener("change", sync);
    window.addEventListener("storage", syncStorage);
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("storage", syncStorage);
    };
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try { localStorage.setItem(themeKey, next); } catch {}
  }
  return (
    <button type="button" className="icon-button theme-toggle" onClick={toggle}
      aria-label={theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"}>
      <Moon size={17} className="theme-moon" aria-hidden="true" />
      <Sun size={18} className="theme-sun" aria-hidden="true" />
    </button>
  );
}
