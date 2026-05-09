"use client";

import { useEffect, useRef } from "react";
import { Mesh, Program, Renderer, Triangle } from "ogl";

const VERTEX_SHADER = /* glsl */ `
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

/**
 * Domain-warped aurora field. Large flowing color zones (acid / teal /
 * copper) drift across the canvas via a noise-driven warp, producing
 * obviously animated organic shapes with no fixed origin or "root" edge.
 * Bold ink isobars cut through the field at low frequency so motion is
 * legible at a glance, and a slow sin-driven pulse periodically flares
 * the brightest ridges — the shader reads as living, not still.
 */
const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec2 uResolution;

  vec3 mod289_3(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289_2(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289_3(((x * 34.0) + 1.0) * x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(
      0.211324865405187,
      0.366025403784439,
     -0.577350269189626,
      0.024390243902439
    );
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289_2(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                    + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
                            dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 3; i++) {
      v += a * snoise(p);
      p = p * 2.0 + vec2(100.0);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    float aspect = uResolution.x / uResolution.y;
    vec2 q = vec2(uv.x * aspect, uv.y);

    float t = uTime;

    // Domain warp: each pixel samples noise at a position that itself
    // flows through another noise field. No fixed roots, only flow.
    vec2 w1 = vec2(
      fbm(q * 0.85 + vec2(t * 0.10, 0.0)),
      fbm(q * 0.85 + vec2(5.2, t * 0.10))
    );
    vec2 warpedQ = q + w1 * 0.65;

    // Big slow noise field — large shapes (~1/3 of viewport each).
    float n = fbm(warpedQ * 0.55 + vec2(t * 0.07, t * 0.05));

    vec3 paper  = vec3(0.965, 0.949, 0.918);
    vec3 acid   = vec3(1.000, 0.894, 0.412);
    vec3 teal   = vec3(0.059, 0.416, 0.416);
    vec3 copper = vec3(0.741, 0.557, 0.204);
    vec3 ink    = vec3(0.043, 0.059, 0.071);

    // Bold color zones driven by signed noise + bright ridges.
    float warm  = smoothstep(0.00,  0.55, n);
    float cool  = smoothstep(0.00, -0.55, n);
    float spark = smoothstep(0.55,  0.95, n);

    vec3 color = paper;
    color = mix(color, acid,   warm  * 0.55);
    color = mix(color, teal,   cool  * 0.42);
    color = mix(color, copper, spark * 0.22);

    // ~12s breathing pulse on the brightest ridges so motion is unmissable.
    float pulse = 0.5 + 0.5 * sin(t * 0.5);
    color = mix(color, acid, pulse * spark * 0.18);

    // Major isobars: low frequency, clearly visible but not heavy enough
    // to compete with foreground text.
    float major = abs(fract(n * 2.5 + 0.5) - 0.5);
    float majorMask = 1.0 - smoothstep(0.020, 0.090, major);
    color = mix(color, ink, majorMask * 0.42);

    // Minor isobars for fine grain detail.
    float minor = abs(fract(n * 7.0 + 0.5) - 0.5);
    float minorMask = 1.0 - smoothstep(0.005, 0.020, minor);
    color = mix(color, ink, minorMask * 0.14);

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function ShaderBg() {
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
      fragment: FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: [container.clientWidth, container.clientHeight] },
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
      program.uniforms.uTime.value = 14.0;
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
