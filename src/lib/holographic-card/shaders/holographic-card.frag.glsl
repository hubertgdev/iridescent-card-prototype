#version 300 es

precision highp float;

uniform sampler2D uShapeTex;
uniform sampler2D uGoldTex;
uniform vec2 uTilt;
uniform float uTime;

in vec2 vUv;

out vec4 fragColor;

// --- Tilt-driven reflection sweep ---
// How strongly the tilt shifts the reflection band across the card.
#define SHEEN_TILT_STRENGTH 1.5

// --- Dark metallic base ---
#define METAL_BASE_COLOR vec3(0.05, 0.055, 0.07)
#define METAL_HIGHLIGHT_COLOR vec3(0.45, 0.48, 0.55)
// Width of the metal reflection band (larger = more diffused).
#define METAL_SHEEN_WIDTH 0.5
// How much the reflection brightens the metal (0..1).
#define METAL_SHEEN_INTENSITY 0.4

// --- Golden areas ---
#define GOLD_BASE_COLOR vec3(0.45, 0.3, 0.08)
#define GOLD_HIGHLIGHT_COLOR vec3(1.4, 1.2, 0.7)
// Width of the gold reflection band (larger = more diffused).
#define GOLD_SHEEN_WIDTH 0.2
// Sharpness of the gold reflection falloff (higher = narrower hotspot).
#define GOLD_SHEEN_SHARPNESS 4.0

// --- Sparkle grain (golden areas only) ---
// Density of the glitter grid (higher = smaller, more numerous specks).
#define SPARKLE_GRID_SIZE 320.0
// How much the sparkle pattern shifts as the card is tilted.
#define SPARKLE_TILT_SHIFT 40.0
// Twinkle animation speed.
#define SPARKLE_SPEED 6.0
// Threshold in [0, 1): higher = fewer sparkles.
#define SPARKLE_THRESHOLD 0.992
// Brightness added by each sparkle.
#define SPARKLE_INTENSITY 1.5

// Cheap pseudo-random hash, used for the glitter grain.
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 34.45);
  return fract(p.x * p.y);
}

void main() {
  float shapeMask = texture(uShapeTex, vUv).r;
  if (shapeMask < 0.5) {
    discard;
  }

  float goldMask = texture(uGoldTex, vUv).r;

  // Diagonal coordinate used to sweep a light band across the card.
  // It shifts with the tilt so the reflection reacts to the drag.
  float diag = vUv.x + vUv.y;
  float sheenPos = 1.0 + uTilt.x * SHEEN_TILT_STRENGTH - uTilt.y * SHEEN_TILT_STRENGTH;
  float sheenDist = abs(diag - sheenPos);

  // --- Dark metallic base ---
  float metalSheen = 1.0 - smoothstep(0.0, METAL_SHEEN_WIDTH, sheenDist);
  vec3 metalColor = mix(METAL_BASE_COLOR, METAL_HIGHLIGHT_COLOR, metalSheen * METAL_SHEEN_INTENSITY);

  // --- Golden areas ---
  float goldSheen = 1.0 - smoothstep(0.0, GOLD_SHEEN_WIDTH, sheenDist);
  vec3 goldColor = mix(GOLD_BASE_COLOR, GOLD_HIGHLIGHT_COLOR, pow(goldSheen, GOLD_SHEEN_SHARPNESS));

  // Sparkle grain: a sparse field of glitter points that flicker and
  // shift slightly with the tilt, only visible on the golden areas.
  vec2 grainUv = floor(vUv * SPARKLE_GRID_SIZE);
  float sparkleSeed = hash(grainUv + floor(uTilt * SPARKLE_TILT_SHIFT));
  float twinkle = 0.5 + 0.5 * sin(uTime * SPARKLE_SPEED + sparkleSeed * 30.0);
  float sparkle = step(SPARKLE_THRESHOLD, sparkleSeed) * twinkle;
  goldColor += sparkle * SPARKLE_INTENSITY;

  vec3 color = mix(metalColor, goldColor, goldMask);

  fragColor = vec4(color, shapeMask);
}
