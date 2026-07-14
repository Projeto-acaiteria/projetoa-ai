"use client";
import { useEffect, useRef, useState } from "react";

// Revela o conteúdo (sobe + fade) quando entra na viewport. Uma vez só. Respeita reduced-motion
// (o CSS .reveal já zera a animação nesse caso). Ilha client dentro das páginas estáticas do site.
export function Reveal({ children, className = "", delay = 0, as: Tag = "div" }: {
  children: React.ReactNode; className?: string; delay?: number; as?: "div" | "section";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); io.disconnect(); } },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={`reveal ${inView ? "in" : ""} ${className}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </Tag>
  );
}
