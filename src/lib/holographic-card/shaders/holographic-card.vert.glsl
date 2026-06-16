#version 300 es

in vec2 aPosition;

// Model-view-projection matrix: rotates the card plane in 3D and projects it,
// so the card can be turned over to reveal its back face.
uniform mat4 uMvp;

out vec2 vUv;

void main() {
  // UVs stay in the card's object space, so the artwork remains glued to the
  // surface as it rotates.
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = uMvp * vec4(aPosition, 0.0, 1.0);
}
