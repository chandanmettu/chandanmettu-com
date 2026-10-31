import * as THREE from "three";

// The figure is modelled standing on the page: x along the page, y up from the paper, z toward
// the reader, with its front face on the hinge line z = 0 and its depth going back (-z).
// liftToPage folds it flat into the oblique picture printed on the page (t = 0) or stands it up
// (t = 1). The flat pose is exactly the printed drawing, so the hand-over never jumps.

export const OBLIQUE = new THREE.Vector2(0.35 * Math.cos(0.7), 0.35 * Math.sin(0.7));

// shared by every ink and paper material of one figure
export function pageUniforms(frame) {
  return {
    uPage: { value: frame.clone() },
    uPageInv: { value: frame.clone().invert() },
    uOblique: { value: OBLIQUE.clone() },
  };
}

export const LIFT_GLSL = /* glsl */ `
uniform mat4 uPage, uPageInv;
uniform vec2 uOblique;
vec3 liftToPage(vec3 world, float t) {
  if (t > 0.9995) return world;
  vec3 p = (uPageInv * vec4(world, 1.0)).xyz;
  float back = max(0.0, -p.z);
  float u = clamp(t, 0.0, 1.0);
  float ang = 1.5707963 * u * u * (3.0 - 2.0 * u);
  float real = pow(u, 8.0);
  vec2 drawn = p.xy + (1.0 - real) * back * uOblique;
  vec3 q = vec3(drawn.x, 0.0, 0.0)
         + drawn.y * vec3(0.0, sin(ang), -cos(ang))
         + real * back * vec3(0.0, -cos(ang), -sin(ang));
  q.y = max(q.y, 0.06 + 0.03 * u);
  return (uPage * vec4(q, 1.0)).xyz;
}`;

// The direction, in figure space, from a point toward the eye of the printed drawing: points
// further back are drawn up and to the right, so the "print eye" sits front, right and above.
export function printEye() {
  return new THREE.Vector3(OBLIQUE.x, OBLIQUE.y, 1).normalize();
}

// The same fold on the CPU, for hit tests and for placing HTML over a flat figure.
export function liftPoint(p, t) {
  if (t > 0.9995) return p.clone();
  const back = Math.max(0, -p.z);
  const u = Math.min(1, Math.max(0, t));
  const ang = (Math.PI / 2) * u * u * (3 - 2 * u);
  const real = Math.pow(u, 8);
  const dx = p.x + (1 - real) * back * OBLIQUE.x;
  const dy = p.y + (1 - real) * back * OBLIQUE.y;
  const q = new THREE.Vector3(dx, 0, 0)
    .addScaledVector(new THREE.Vector3(0, Math.sin(ang), -Math.cos(ang)), dy)
    .addScaledVector(new THREE.Vector3(0, -Math.cos(ang), -Math.sin(ang)), real * back);
  q.y = Math.max(q.y, 0.06 + 0.03 * u);
  return q;
}
