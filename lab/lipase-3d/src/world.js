// The setting at enzyme scale: water above, a droplet of used cooking oil below. At 5 nm the droplet's surface
// is almost flat, so it is drawn as a sphere 180 nm across (real frying-oil droplets in a stirred reactor are
// micrometres: drawn far smaller than life so its curve shows). Fat molecules (triglycerides) crowd the oil side
// of the interface; methanol and water stay on the water side.
import * as THREE from "three";
import { triglyceride, instancedMolecules, mat, MC } from "./chem.js?v=3be210fe";

export const IFACE_Y = -22;      // the oil-water interface (A), protein frame
export const OIL_R = 900;

export function createWorld(scene) {
  const group = new THREE.Group();
  group.name = "world";
  scene.add(group);
  // ---------------------------------------------------------------- the oil
  const oilMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uFade: { value: 1 }, uHot: { value: 0 }, uRipple: { value: 0 }, uRippleF: { value: 0.12 } },
    vertexShader: `varying vec3 vN; varying vec3 vW; varying vec3 vV; uniform float uTime; uniform float uRipple; uniform float uRippleF;
      void main(){ vec4 w = modelMatrix*vec4(position,1.0);
        // mixing: travelling ripples on the top of the droplet (amplitude and frequency from the stirring speed)
        float top = smoothstep(0.85, 1.0, normal.y);
        float r = length(w.xz);
        float wave = sin(r*uRippleF - uTime*3.0) * 0.6 + sin(w.x*uRippleF*0.7 + uTime*2.1) * 0.25 + sin(w.z*uRippleF*0.9 - uTime*2.6) * 0.25;
        w.y += wave * uRipple * top;
        vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal + vec3(cos(r*uRippleF - uTime*3.0)*uRipple*0.08*top, 0.0, 0.0)); vV=normalize(cameraPosition-w.xyz); gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `varying vec3 vN; varying vec3 vW; varying vec3 vV; uniform float uTime; uniform float uFade; uniform float uHot;
      float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y); }
      void main(){
        float fr = pow(1.0-max(dot(vN,vV),0.0), 2.2);
        vec2 q = vW.xz*0.035 + vec2(uTime*0.05, -uTime*0.03);
        float c = n(q)*0.6 + n(q*2.3+3.1)*0.4;
        vec3 deep = vec3(0.30,0.12,0.01), lit = vec3(0.86,0.45,0.07);
        vec3 col = mix(deep, lit, 0.25 + 0.5*c) * (0.5 + 0.85*fr);
        col += vec3(1.0,0.62,0.18) * pow(c, 7.0) * 0.5;
        col += vec3(1.0,0.66,0.26) * pow(fr, 5.0) * 0.55;
        col *= 1.0 + uHot*0.3;
        gl_FragColor = vec4(col, (0.42 + 0.5*fr) * uFade);
        #include <colorspace_fragment>
      }`,
  });
  const oil = new THREE.Mesh(new THREE.SphereGeometry(OIL_R, 160, 120), oilMat);
  oil.position.set(0, IFACE_Y - OIL_R, 0);
  oil.renderOrder = 2;
  group.add(oil);
  // the interface glow ring: where water meets oil, a thin bright skin
  // fat molecules just under the surface
  const tgs = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const centre = new THREE.Vector3(0, IFACE_Y - OIL_R, 0);
  for (let i = 0; i < 60; i++) {
    const a = rnd() * Math.PI * 2, r = 16 + Math.pow(rnd(), 0.8) * 130;
    const top = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
    top.y = centre.y + Math.sqrt(OIL_R * OIL_R - r * r);
    const nrm = top.clone().sub(centre).normalize();
    const o = top.clone().addScaledVector(nrm, -(1.2 + rnd() * 2));
    const ax = nrm.clone().negate().add(new THREE.Vector3((rnd() - 0.5) * 0.6, 0, (rnd() - 0.5) * 0.6)).normalize();
    tgs.push(triglyceride(o, ax, 16, rnd() * 6));
  }
  const fat = instancedMolecules(tgs, { opacity: 1 });
  fat.name = "fat";
  group.add(fat);
  // ---------------------------------------------------------------- the water: drifting specks for depth
  const N = 1400;
  const pts = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pts[3 * i] = (rnd() - 0.5) * 420; pts[3 * i + 1] = IFACE_Y + 2 + rnd() * 220; pts[3 * i + 2] = (rnd() - 0.5) * 420; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.BufferAttribute(pts, 3));
  const spr = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(220,240,255,0.9)"); gr.addColorStop(1, "rgba(220,240,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const specks = new THREE.Points(pg, new THREE.PointsMaterial({ size: 1.1, map: spr, transparent: true, opacity: 0.35, depthWrite: false, sizeAttenuation: true, color: "#bfe0ff" }));
  group.add(specks);
  // methanol in the water near the interface: CH3-OH as two balls and an H
  const meth = [];
  for (let i = 0; i < 22; i++) {
    const a = rnd() * Math.PI * 2, r = 30 + rnd() * 34;
    const o = new THREE.Vector3(Math.cos(a) * r, IFACE_Y + 2 + rnd() * 26, Math.sin(a) * r);
    const d = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
    meth.push({ atoms: [{ p: o, el: "C", kind: "meth" }, { p: o.clone().addScaledVector(d, 1.43), el: "O" }, { p: o.clone().addScaledVector(d, 2.3).addScaledVector(new THREE.Vector3(0, 1, 0), 0.4), el: "H" }], bonds: [[0, 1], [1, 2]] });
  }
  const methanol = instancedMolecules(meth, {});
  methanol.name = "methanol";
  methanol.visible = false;
  group.add(methanol);
  // mixing breaks the surface into small droplets that rise into the water
  const ND = 48, drops = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshPhysicalMaterial({ color: "#d48a17", roughness: 0.15, clearcoat: 0.8, emissive: "#5a3004", emissiveIntensity: 0.4 }), ND);
  const dropSeed = Array.from({ length: ND }, () => [rnd() * Math.PI * 2, 30 + rnd() * 110, 0.6 + rnd() * 1.4, rnd() * 10]);
  drops.count = 0; group.add(drops);
  const M4 = new THREE.Matrix4(), Q4 = new THREE.Quaternion(), V4 = new THREE.Vector3(), S4 = new THREE.Vector3();
  const mix = { rpm: 0, k: 0 };
  return {
    group, oil, oilMat, fat, specks, methanol, drops,
    setMixing(rpm, on) {
      const k = on ? Math.max(0, Math.min(1, (rpm - 100) / 200)) : 0;
      mix.k = k; mix.rpm = rpm;
      oilMat.uniforms.uRipple.value = on ? 0.15 + 2.2 * k : 0;
      oilMat.uniforms.uRippleF.value = 0.08 + 0.14 * k;
      drops.count = on ? Math.round(ND * Math.max(0, (rpm - 140) / 160)) : 0;
    },
    updateDrops(t) {
      for (let i = 0; i < drops.count; i++) {
        const [a, r, sz, ph] = dropSeed[i];
        const life = ((t * 0.18 + ph) % 1);
        V4.set(Math.cos(a + t * 0.05) * r, IFACE_Y + 1 + life * 26 * (0.5 + mix.k), Math.sin(a + t * 0.05) * r);
        S4.setScalar(sz * (1 - life * 0.5) * (0.6 + 0.6 * mix.k));
        M4.compose(V4, Q4, S4); drops.setMatrixAt(i, M4);
      }
      drops.instanceMatrix.needsUpdate = true;
    },
    update(dt, t) { oilMat.uniforms.uTime.value = t; specks.rotation.y = t * 0.004; specks.position.y = Math.sin(t * 0.2) * 1.5; },
    fade(v) { oilMat.uniforms.uFade.value = v; for (const m of fat.userData.materials) { m.opacity = v; m.transparent = v < 0.999; m.depthWrite = true; } specks.material.opacity = 0.35 * v; group.visible = v > 0.01; },
  };
}
