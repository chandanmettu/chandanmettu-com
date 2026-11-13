import * as THREE from "three";
import { Furnace } from "./figures/furnace.js?v=f9d0af7e";
import { Coke } from "./figures/coke.js?v=f9d0af7e";
import { Sinter } from "./figures/sinter.js?v=f9d0af7e";
import { Raw } from "./figures/raw.js?v=f9d0af7e";
import { Lineup } from "./figures/lineup.js?v=f9d0af7e";
import { OBLIQUE } from "./lift.js?v=f9d0af7e";

// Where each figure stands on the poster: its hinge line on the sheet (x of its left end, z of the
// line). The furnace complex takes the right of the poster; the three units that prepare its
// burden stack down the left, in the order the material moves.
export const FRAMES = {
  raw: { x: -568, z: -150, chapter: "raw" },
  coke: { x: -568, z: 44, chapter: "coke" },
  sinter: { x: -568, z: 252, chapter: "sinter" },
  furnace: { x: -112, z: 352, chapter: "furnace" },
  lineup: { x: 70, z: -100, chapter: "future" },
};

const MODULES = { raw: Raw, coke: Coke, sinter: Sinter, furnace: Furnace, lineup: Lineup };
export function registerFigure(id, Cls) { MODULES[id] = Cls; }

export const LAYOUT = [
  { id: "raw", label: "Fig. 1", caption: "Raw materials handling: wagon tippler, blending bed, reclaimer.", x: -568, z: -150, capW: 400 },
  { id: "coke", label: "Fig. 2", caption: "A coke oven battery of 78 ovens, with one oven drawn large.", x: -568, z: 44, capW: 400 },
  { id: "sinter", label: "Fig. 3", caption: "A sinter strand: the flame burns down while the bed rides along.", x: -568, z: 252, capW: 400 },
  { id: "furnace", label: "Fig. 4", caption: "BF-3 at 1 : 167 with its stoves, gas train and cast house. Cut it open on screen.", x: -92, z: 352, capW: 560 },
  { id: "lineup", label: "Fig. 5", caption: "Five furnaces to one scale (2 mm to the metre); BF-5 is planned.", x: 70, z: -100, capW: 400 },
];
LAYOUT.arrows = [
  { pts: [[-330, -176], [-300, -176], [-300, -30]], label: "coal", at: 0.6, side: 1 },
  { pts: [[-318, -196], [-232, -196], [-232, 160]], label: "ore fines, flux", at: 0.7, side: 1 },
  { pts: [[-256, 26], [-218, 26], [-218, 150]], label: "breeze", at: 0.7, side: 1 },
  { pts: [[-256, -10], [-150, -10], [-150, 180], [-100, 180]], label: "coke", at: 0.45, side: -1 },
  { pts: [[-300, 214], [-180, 214], [-180, 250], [-100, 250]], label: "sinter", at: 0.2, side: 1 },
  { pts: [[-330, -214], [-130, -214], [-130, 120], [-100, 120]], label: "lump ore, flux", at: 0.3, side: 1 },
];

export function buildPlant({ spill }) {
  const list = [], byId = {};
  for (const [id, F] of Object.entries(FRAMES)) {
    const Cls = MODULES[id];
    if (!Cls) continue;
    const frame = new THREE.Matrix4().makeTranslation(F.x, 0.05, F.z);
    const fig = new Cls({ frame, spill });
    fig.group.updateMatrixWorld(true);
    // the figure's extent in its own frame, for picking (standing) and its printed footprint
    const local = new THREE.Box3();
    for (const m of fig.surfaces) { m.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(m); local.union(b); }
    const box = local.clone(); // already world, as the meshes sit in the placed group
    const inv = new THREE.Matrix4().copy(frame).invert();
    const lb = box.clone().applyMatrix4(inv);
    const depth = Math.max(0, -lb.min.z);
    const print = new THREE.Box3(
      new THREE.Vector3(F.x + lb.min.x, -1, F.z - (lb.max.y + OBLIQUE.y * depth)),
      new THREE.Vector3(F.x + lb.max.x + OBLIQUE.x * depth, 1, F.z + 4),
    );
    const entry = { id, fig, frame, box, print, chapter: F.chapter, local: lb };
    if (fig.drawTags) entry.drawTags = (ctx) => fig.drawTags(ctx);
    list.push(entry); byId[id] = entry;
  }
  return { list, byId };
}
