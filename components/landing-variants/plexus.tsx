"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { GrainOverlay } from "@/components/landing/grain-overlay";
import { SignInCTA } from "@/components/landing/sign-in-cta";

interface Point {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

const NUM_POINTS = 70;
const CONNECT_DIST = 150;
const POINT_RADIUS = 1.6;

function PlexusCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    container.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = container.clientWidth;
    let h = container.clientHeight;
    let points: Point[] = [];
    let mouse: { x: number; y: number } | null = null;

    const seedPoints = () => {
      points = Array.from({ length: NUM_POINTS }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: POINT_RADIUS + Math.random() * 0.6,
      }));
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = container.clientWidth;
      h = container.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seedPoints();
    };
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(container);

    const handleMove = (e: MouseEvent) => {
      mouse = { x: e.clientX, y: e.clientY };
    };
    const handleLeave = () => {
      mouse = null;
    };
    window.addEventListener("mousemove", handleMove, { passive: true });
    window.addEventListener("mouseleave", handleLeave);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const prefersReduced = reduced.matches;

    let rafId: number | null = null;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      for (const p of points) {
        if (!prefersReduced) {
          p.x += p.vx;
          p.y += p.vy;
        }
        if (mouse) {
          const mdx = p.x - mouse.x;
          const mdy = p.y - mouse.y;
          const md = Math.sqrt(mdx * mdx + mdy * mdy);
          if (md < 120 && md > 0.001) {
            const force = (1 - md / 120) * 0.6;
            p.x += (mdx / md) * force;
            p.y += (mdy / md) * force;
          }
        }
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        p.x = Math.max(0, Math.min(w, p.x));
        p.y = Math.max(0, Math.min(h, p.y));
      }

      ctx.lineWidth = 0.7;
      for (let i = 0; i < points.length; i++) {
        const a = points[i];
        if (!a) continue;
        for (let j = i + 1; j < points.length; j++) {
          const b = points[j];
          if (!b) continue;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < CONNECT_DIST) {
            const alpha = (1 - d / CONNECT_DIST) * 0.35;
            ctx.strokeStyle = `rgba(15, 106, 106, ${alpha.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (const p of points) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(11, 15, 18, 0.85)";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(189, 142, 52, 0.10)";
        ctx.fill();
      }

      rafId = requestAnimationFrame(draw);
    };

    if (prefersReduced) {
      draw();
    } else {
      rafId = requestAnimationFrame(draw);
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseleave", handleLeave);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="fixed inset-0 z-0 overflow-hidden"
      style={{ pointerEvents: "none" }}
    />
  );
}

const Canvas = dynamic(() => Promise.resolve(PlexusCanvas), { ssr: false });

/**
 * Rendition 03 — Particle Plexus.
 * 70 nodes drift on a 2D canvas; pairs within a threshold connect with
 * teal lines whose alpha falls off with distance. Cursor gently repels
 * nearby nodes so the network breathes when the user moves the mouse.
 * Symmetric centered layout: brand mark · headline · supporting copy ·
 * sign-in.
 */
export function PlexusVariant() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <Canvas />
      <GrainOverlay />

      <div className="pointer-events-none absolute left-1/2 top-6 z-20 -translate-x-1/2">
        <div className="surface-glass pointer-events-auto flex items-center gap-2.5 rounded-full px-4 py-2">
          <Image
            src="/logos/cs-soc-official.svg"
            alt=""
            width={22}
            height={22}
            priority
            className="h-[22px] w-[22px]"
            aria-hidden
          />
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--ink)]">
            USM CSS AGM
          </span>
        </div>
      </div>

      <section className="container-narrow relative z-20 flex min-h-[100dvh] flex-col items-center justify-center gap-10 py-32 text-center">
        <div className="surface-glass rounded-full px-4 py-1.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--ink)]">
            70 nodes — one decision
          </span>
        </div>

        <h1 className="font-display text-[clamp(2.5rem,7vw,6rem)] leading-[0.96] tracking-[-0.04em] text-[var(--ink)]">
          Many voices.
          <br />
          One committee.
        </h1>

        <p className="max-w-[40ch] text-base leading-relaxed text-[var(--ink-muted)]">
          Every member of USM Computer Science Society casts one vote. Sign in
          to see the role you play in this year&rsquo;s AGM.
        </p>

        <SignInCTA />
      </section>

      <footer className="container-wide absolute inset-x-0 bottom-6 z-20 flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
          USM Computer Science Society
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
          rendition · 03 / particle plexus
        </p>
      </footer>
    </main>
  );
}
