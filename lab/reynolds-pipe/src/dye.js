import * as THREE from "three";

// The dye in the tube, ray-marched through the bore. The model's three fields along the tube
// (unmixed thread, mixed dye, turbulence) arrive as a 1D texture; the shader turns them into a
// thin glowing thread that wavers, tears and fills the bore with eddies.

export const DYE = "#7a3cff";

export function dyeVolume({ radius, length, cells, color = DYE }) {
  const data = new Uint8Array(cells * 4);
  const field = new THREE.DataTexture(data, cells, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
  field.magFilter = THREE.LinearFilter;
  field.minFilter = THREE.LinearFilter;
  field.wrapS = field.wrapT = THREE.ClampToEdgeWrapping;
  field.needsUpdate = true;

  const geo = new THREE.CylinderGeometry(radius, radius, length, 40, 1, true);
  geo.rotateZ(-Math.PI / 2); // axis along +x, cross-section in (y, z)

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uField: { value: field },
      uCam: { value: new THREE.Vector3() },
      uR: { value: radius },
      uLen: { value: length },
      uTime: { value: 0 },
      uFlowX: { value: 0 },
      uThreadX: { value: 0 },
      uDye: { value: new THREE.Color(color) },
      uGlow: { value: 1.35 },
      uAlpha: { value: 1 },
    },
    vertexShader: /* glsl */ `
varying vec3 vLocal;
void main() {
  vLocal = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: /* glsl */ `
uniform sampler2D uField;
uniform vec3 uCam, uDye;
uniform float uR, uLen, uTime, uFlowX, uThreadX, uGlow, uAlpha;
varying vec3 vLocal;
float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n3(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { return 0.55 * n3(p) + 0.3 * n3(p * 2.03 + 7.1) + 0.15 * n3(p * 4.1 + 3.3); }
void main() {
  vec3 ro = vLocal;
  vec3 rd = normalize(vLocal - uCam);
  float a = dot(rd.yz, rd.yz);
  float b = 2.0 * dot(ro.yz, rd.yz);
  float c = dot(ro.yz, ro.yz) - uR * uR;
  float disc = max(b * b - 4.0 * a * c, 0.0);
  float tExit = max((-b + sqrt(disc)) / max(2.0 * a, 1e-5), 0.0);
  const int N = 30;
  float dt = tExit / float(N);
  float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  vec3 acc = vec3(0.0);
  float trans = 1.0;
  for (int i = 0; i < N; i++) {
    vec3 p = ro + rd * (dt * (float(i) + jitter));
    float xi = (p.x + 0.5 * uLen) / uLen;
    if (xi < 0.0 || xi > 1.0) continue;
    vec4 f = texture2D(uField, vec2(xi, 0.5));
    float th = f.r, mx = f.g, tau = f.b;
    // the thread rides the axis; disturbance makes it waver before it tears
    float xs = p.x - uThreadX;
    vec2 wig = tau * uR * 0.42 * vec2(sin(xs * 0.85 + 1.3 * sin(xs * 0.31)), cos(xs * 0.66 + 0.9));
    float w = uR * (0.075 + 0.3 * tau);
    vec2 q = p.yz - wig;
    float dens = th * exp(-dot(q, q) / (w * w)) * 3.2 / (1.0 + 3.0 * tau);
    // torn dye: eddies carried with the bulk, each slice of the bore rolled by its own angle
    vec3 e = vec3((p.x - uFlowX) * 0.55, p.y * 1.15, p.z * 1.15);
    float ang = 6.2832 * n3(vec3(e.x * 0.3, 2.7, uTime * 0.22));
    float ca = cos(ang), sa = sin(ang);
    e.yz = mat2(ca, -sa, sa, ca) * e.yz;
    float n = fbm(e + vec3(0.0, 0.0, uTime * 0.45));
    float blob = smoothstep(0.5, 0.72, n);
    float r2 = dot(p.yz, p.yz) / (uR * uR);
    dens += mx * (0.03 + 3.0 * blob) * (1.0 - 0.3 * r2);
    float ai = 1.0 - exp(-dens * dt * 1.5);
    acc += trans * ai * uDye;
    trans *= 1.0 - ai;
  }
  float alpha = (1.0 - trans) * uAlpha;
  vec3 col = acc * uGlow * uAlpha;
  col += vec3(1.0) * pow(1.0 - trans, 3.0) * 0.18 * uAlpha;   // a pale core where the dye is thick
  gl_FragColor = vec4(col, alpha);
}`,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 5;

  // copy the model's fields in: thread, mixed, turbulence
  function update(flow) {
    const n = Math.min(cells, flow.cells);
    for (let i = 0; i < n; i++) {
      data[i * 4] = Math.round(255 * Math.min(1, flow.thread[i]));
      data[i * 4 + 1] = Math.round(255 * Math.min(1, flow.mixed[i]));
      data[i * 4 + 2] = Math.round(255 * Math.min(1, flow.tau[i]));
      data[i * 4 + 3] = 255;
    }
    field.needsUpdate = true;
  }
  return { mesh, material: mat, update, field };
}
