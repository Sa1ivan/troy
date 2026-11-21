"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function PageMotion({ children }: { children: ReactNode }) {
  const page = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = page.current;
    if (!root || matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries) => {
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting) continue;
        (target as HTMLElement).dataset.revealState = "visible";
        observer.unobserve(target);
      }
    }, { threshold: 0.08 });
    for (const element of root.querySelectorAll<HTMLElement>("[data-reveal]")) {
      if (element.getBoundingClientRect().top < window.innerHeight) continue;
      element.dataset.revealState = "waiting";
      observer.observe(element);
    }
    return () => observer.disconnect();
  }, []);
  return <div ref={page} className="page-motion">{children}</div>;
}
