#version 300 es

precision highp float;

uniform sampler2D uShapeTex;
uniform sampler2D uFrontFoilTex;
uniform sampler2D uBackFoilTex;
uniform vec2 uTilt;

in vec2 vUv;

out vec4 fragColor;

// --- Tilt-driven reflection sweep ---
// How strongly the tilt shifts the reflection band across the card.
#define SHEEN_TILT_STRENGTH 1.5

// --- Dark matte base ---
#define METAL_BASE_COLOR vec3(0.05, 0.055, 0.07)
#define METAL_HIGHLIGHT_COLOR vec3(0.16, 0.17, 0.2)
// Width of the reflection band (larger = more diffused).
#define METAL_SHEEN_WIDTH 0.75
// How much the reflection brightens the base (0..1). Low = matte, barely
// catching the light.
#define METAL_SHEEN_INTENSITY 0.5

// --- Golden areas ---
#define GOLD_BASE_COLOR vec3(0.45, 0.3, 0.08)
#define GOLD_HIGHLIGHT_COLOR vec3(1.1, 1.05, 0.625)
// Width of the gold reflection band (larger = more diffused).
#define GOLD_SHEEN_WIDTH 0.5
// Sharpness of the gold reflection falloff (higher = narrower hotspot).
#define GOLD_SHEEN_SHARPNESS 5.0

// --- Sparkle grain (golden areas only) ---
// Density of the glitter grid (higher = smaller, more numerous specks).
#define SPARKLE_GRID_SIZE 800.0
// Threshold in [0, 1): higher = fewer sparkles.
#define SPARKLE_THRESHOLD 0.992
// Gold tint of the sparkles (more intense/saturated than GOLD_HIGHLIGHT_COLOR).
#define SPARKLE_COLOR vec3(1.8, 1.4, 0.5)
// Sparkle brightness boost when NOT caught by the reflection (kept faintly visible).
#define SPARKLE_DIM_BOOST 0.15
// Sparkle brightness boost when caught by the reflection.
#define SPARKLE_LIT_BOOST 1.6

// Cheap pseudo-random hash, used for the glitter grain.
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 34.45);
  return fract(p.x * p.y);
}

void main() {
  // When the card is turned over, its back face reads mirrored across the
  // vertical axis (as a real flipped card would), so mirror the lookup to keep
  // the back artwork the right way round.
  vec2 uv = vUv;
  if (!gl_FrontFacing) {
    uv.x = 1.0 - uv.x;
  }

  float shapeMask = texture(uShapeTex, uv).r;
  if (shapeMask < 0.5) {
    discard;
  }

  // The golden foil alpha map differs per face.
  float goldMask = gl_FrontFacing ? texture(uFrontFoilTex, uv).r : texture(uBackFoilTex, uv).r;

  // Diagonal coordinate used to sweep a light band across the card.
  // It shifts with the tilt so the reflection reacts to the orientation.
  float diag = uv.x + uv.y;
  float sheenPos = 1.0 + uTilt.x * SHEEN_TILT_STRENGTH - uTilt.y * SHEEN_TILT_STRENGTH;
  float sheenDist = abs(diag - sheenPos);

  // --- Dark metallic base ---
  float metalSheen = 1.0 - smoothstep(0.0, METAL_SHEEN_WIDTH, sheenDist);
  vec3 metalColor = mix(METAL_BASE_COLOR, METAL_HIGHLIGHT_COLOR, metalSheen * METAL_SHEEN_INTENSITY);

  // --- Golden areas ---
  float goldSheen = 1.0 - smoothstep(0.0, GOLD_SHEEN_WIDTH, sheenDist);
  vec3 goldColor = mix(GOLD_BASE_COLOR, GOLD_HIGHLIGHT_COLOR, pow(goldSheen, GOLD_SHEEN_SHARPNESS));

  // Sparkle grain: a sparse field of glitter points fixed to the card
  // surface, that glow brighter gold when caught by the reflection band.
  vec2 grainUv = floor(uv * SPARKLE_GRID_SIZE);
  float sparkleSeed = hash(grainUv);
  float sparkleMask = step(SPARKLE_THRESHOLD, sparkleSeed);
  float sparkleBoost = mix(SPARKLE_DIM_BOOST, SPARKLE_LIT_BOOST, goldSheen);
  goldColor += sparkleMask * sparkleBoost * SPARKLE_COLOR;

  vec3 color = mix(metalColor, goldColor, goldMask);

  fragColor = vec4(color, shapeMask);
}
