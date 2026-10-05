"use client";

import { useEffect, useRef } from "react";

// Two sheaves of fine lines sloping opposite ways, so they cross: the ribbon
// style's background (the same drawing as the landing repo's
// stage/Ribbons.jsx). Colors come from --ra and --rb where the canvas sits,
// so dark mode and a card's own pair both work.
const BANDS = [
  { base: 0.4, slope: 0.34, f1: 5.2, s1: 0.22, f2: 11, s2: 0.31, ph: 0 },
  { base: 0.6, slope: -0.34, f1: 4.4, s1: 0.18, f2: 9.5, s2: 0.27, ph: 2.1 },
];

function reducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * `animate` keeps the ribbons drifting (30 frames a second, only while on
 * screen); otherwise they're drawn once. `at` is a still one's moment, and
 * a moving one's head start, so no two look the same.
 */
export function Ribbons({ animate = false, at = 12 }: { animate?: boolean; at?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    const host = cv?.parentElement;
    const ctx = cv?.getContext("2d");
    if (!cv || !host || !ctx) return;
    const moving = animate && !reducedMotion();
    let lines = 18;
    let W = 0;
    let H = 0;
    let colA = "#2d6a4f";
    let colB = "#c9970a";
    let visible = true;
    let raf = 0;
    let last = 0;

    const readColors = () => {
      const cs = getComputedStyle(cv);
      colA = cs.getPropertyValue("--ra").trim() || colA;
      colB = cs.getPropertyValue("--rb").trim() || colB;
    };
    const draw = (t: number) => {
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1;
      for (let b = 0; b < BANDS.length; b++) {
        const B = BANDS[b];
        ctx.strokeStyle = b === 0 ? colA : colB;
        for (let i = 0; i < lines; i++) {
          const u = i / (lines - 1);
          const c = 1 - Math.abs(u - 0.5) * 2;
          ctx.globalAlpha = 0.08 + 0.42 * c * c;
          ctx.beginPath();
          for (let x = -10; x <= W + 10; x += 6) {
            const p = x / W;
            const open = 0.3 + 0.7 * Math.sin(p * Math.PI + t * 0.07 + B.ph) ** 2;
            const y =
              H * B.base +
              H * B.slope * (p - 0.5) +
              Math.sin(p * B.f1 + t * B.s1 + u * 1.3 + B.ph) * H * 0.1 +
              Math.sin(p * B.f2 - t * B.s2 + u * 2.6) * H * 0.028 +
              (u - 0.5) * H * 0.26 * open;
            if (x === -10) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    };
    const still = () => draw(at);
    const size = () => {
      const r = host.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width;
      H = r.height;
      if (!W || !H) return;
      lines = H >= 300 ? 30 : 18;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!moving) still();
    };
    const frame = (ms: number) => {
      if (visible && ms - last >= 32) {
        last = ms;
        draw(ms / 1000 + at);
      }
      raf = requestAnimationFrame(frame);
    };
    const recolor = () => {
      readColors();
      if (!moving) still();
    };

    readColors();
    size();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(size) : null;
    if (ro) ro.observe(host);
    else window.addEventListener("resize", size);
    const mo = new MutationObserver(recolor);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    let io: IntersectionObserver | undefined;
    if (moving) {
      if (typeof IntersectionObserver !== "undefined") {
        io = new IntersectionObserver(([e]) => {
          visible = e.isIntersecting;
        });
        io.observe(host);
      }
      raf = requestAnimationFrame(frame);
    }
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("resize", size);
      mo.disconnect();
      io?.disconnect();
    };
  }, [animate, at]);

  return <canvas ref={ref} className="ribbons" aria-hidden="true" />;
}
