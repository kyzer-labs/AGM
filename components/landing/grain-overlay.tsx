"use client";

export function GrainOverlay() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-[5] h-full w-full"
      style={{
        opacity: 0.04,
        mixBlendMode: "overlay",
      }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <filter id="agm-grain">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.9"
          numOctaves="2"
          stitchTiles="stitch"
        />
        <feColorMatrix
          type="matrix"
          values="0 0 0 0 0
                  0 0 0 0 0
                  0 0 0 0 0
                  0 0 0 0.7 0"
        />
      </filter>
      <rect width="100%" height="100%" filter="url(#agm-grain)" />
    </svg>
  );
}
