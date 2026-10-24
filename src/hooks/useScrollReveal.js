import { useEffect } from "react";

/*
 * useScrollReveal
 * Lightweight scroll-triggered reveals using IntersectionObserver.
 * - Targets elements matching selector (default: '.reveal')
 * - Adds 'is-visible' once when element enters viewport
 * - Cleans up observer on unmount
 * - Respects prefers-reduced-motion (observer may be skipped if desired, but CSS handles it)
 */
export default function useScrollReveal(selector = ".reveal", options = {}) {
  useEffect(() => {
    // If user prefers reduced motion, do nothing (CSS will keep content visible)
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const elements = Array.from(document.querySelectorAll(selector));
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            // Animate only once
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -40px 0px",
        ...options,
      },
    );

    elements.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, [selector, options]);
}
