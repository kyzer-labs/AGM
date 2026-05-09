/**
 * Common GLSL helpers shared across landing renditions:
 *   - 2D simplex noise (Ashima)
 *   - 3-octave fractional Brownian motion built on snoise
 *   - cssoc-merch palette colors as vec3 constants
 *
 * Concatenate these strings with a fragment-shader main() that declares
 *   uniform float uTime;
 *   uniform vec2 uResolution;
 */

export const SHADER_NOISE = /* glsl */ `
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
`;

export const SHADER_PALETTE = /* glsl */ `
  const vec3 PAPER  = vec3(0.965, 0.949, 0.918);
  const vec3 ACID   = vec3(1.000, 0.894, 0.412);
  const vec3 TEAL   = vec3(0.059, 0.416, 0.416);
  const vec3 COPPER = vec3(0.741, 0.557, 0.204);
  const vec3 INK    = vec3(0.043, 0.059, 0.071);
`;

export const SHADER_HEADER = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform vec2 uResolution;
`;
