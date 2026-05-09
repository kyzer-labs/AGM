import Image from "next/image";

/**
 * Locked landing backdrop.
 *
 * A single hand-painted sumi-e ink-wash composite carrying the full
 * composition: heavy charcoal billows in the top-right and bottom-
 * left, lighter wisps in the top-left and bottom-right, copper
 * calligraphic threads weaving through the smoke regions, and a wide
 * cream centre band reserved for the headline + CTA.
 *
 * The composite is animated as a whole, not per-element. A slow macro
 * "breath" (26s, scale 1.0 → 1.025, opacity 0.97 → 1.0) gives the
 * painting a sense of being alive without breaking the compositional
 * integrity that made it work in the first place. Reduced-motion
 * users see a completely still image; the keyframe is gated behind
 * `@media (prefers-reduced-motion: no-preference)` in globals.css.
 *
 * History.
 *   - V1 (live OGL shader): paid continuous GPU cost for ~85 percent
 *     mock fidelity. Replaced.
 *   - V2 (single composite, no motion): 100 percent mock fidelity but
 *     felt completely dead.
 *   - V3 (seven layered transparent PNGs with per-element breath /
 *     shimmer): each element looked good in isolation but the
 *     composition fragmented because layers cannot reconstruct the
 *     natural integration of a single painted scene. Reverted.
 *   - V4 (this version): single composite again, with a subtle macro-
 *     breath applied to the whole image. Composition stays intact,
 *     the painting feels alive without any element ever looking like
 *     a separate cutout.
 *
 * Decorative (`aria-hidden`) and `pointer-events-none` so the layer
 * never intercepts a tap on the CTA underneath.
 */
export function LandingBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <Image
        src="/landing/sumi-backdrop.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="breath-composite object-cover object-center select-none"
      />
    </div>
  );
}
