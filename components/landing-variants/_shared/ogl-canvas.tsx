"use client";

import { useEffect, useRef } from "react";
import { Mesh, Program, Renderer, Triangle } from "ogl";

const VERTEX_SHADER = /* glsl */ `
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

interface OglCanvasProps {
  /** Fragment shader source. Must declare uniform float uTime; uniform vec2 uResolution; */
  fragment: string;
  /** Static time value used when prefers-reduced-motion is set, so the static
   *  frame still has a pleasant composition. */
  reducedMotionTime?: number;
}

/**
 * Reusable fullscreen OGL fragment-shader canvas. Sits at z-0 above the
 * body background but below page content (page content should use z >= 10).
 * Handles ResizeObserver, devicePixelRatio, and clean WebGL teardown.
 */
export function OglCanvas({
  fragment,
  reducedMotionTime = 14.0,
}: OglCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (typeof window === "undefined") return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const prefersReduced = reduced.matches;

    let renderer: Renderer | null = null;
    try {
      renderer = new Renderer({
        alpha: true,
        antialias: false,
        dpr: Math.min(window.devicePixelRatio || 1, 2),
      });
    } catch {
      return;
    }
    const gl = renderer.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    container.appendChild(canvas);

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex: VERTEX_SHADER,
      fragment,
      uniforms: {
        uTime: { value: 0 },
        uResolution: {
          value: [container.clientWidth, container.clientHeight],
        },
      },
    });
    const mesh = new Mesh(gl, { geometry, program });

    const resize = () => {
      if (!renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      program.uniforms.uResolution.value = [
        w * renderer.dpr,
        h * renderer.dpr,
      ];
      renderer.render({ scene: mesh });
    };
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(container);

    let rafId: number | null = null;
    const start = performance.now();

    const loop = (now: number) => {
      if (!renderer) return;
      program.uniforms.uTime.value = (now - start) / 1000;
      renderer.render({ scene: mesh });
      rafId = requestAnimationFrame(loop);
    };

    if (prefersReduced) {
      program.uniforms.uTime.value = reducedMotionTime;
      renderer.render({ scene: mesh });
    } else {
      rafId = requestAnimationFrame(loop);
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      observer.disconnect();
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
      const loseExt = gl.getExtension("WEBGL_lose_context");
      if (loseExt && typeof loseExt === "object" && "loseContext" in loseExt) {
        (loseExt as { loseContext(): void }).loseContext();
      }
      renderer = null;
    };
  }, [fragment, reducedMotionTime]);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="fixed inset-0 z-0 overflow-hidden"
      style={{ pointerEvents: "none" }}
    />
  );
}
