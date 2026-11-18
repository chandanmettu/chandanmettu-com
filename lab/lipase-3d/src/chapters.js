// The six chapters, each a list of steps. A step sets the camera, the lid, the view, what is shown, the labels
// and the card text. Numbers in the text come from the coordinates (ctx.m) or the sources table.
// glass: the ribbon's opacity when it turns to glass (1 = solid). sticks: show the catalytic residues.
import { STEPS, STEP_DUR } from "./chem.js?v=3be210fe";

const f1 = (v) => v.toFixed(1);

export const CHAPTERS = [
  {
    id: "meet", short: "In water", kicker: "01 · The enzyme",
    steps: [
      { title: "Thermomyces lanuginosus lipase", dur: 9,
        body: (c) => `<p>One chain of ${c.m.nRes} amino acids, about ${c.m.size} across, drawn from its crystal structure (PDB 1DT3). It is the lipase inside Lipozyme TL IM and the Eversa biodiesel enzymes.</p><p class="small">Ribbons: <b class="h">helices</b> and <b class="e">β-strands</b> of the α/β-hydrolase fold, and the <b class="l">lid</b>.</p>`,
        cam: { az: 200, el: 12, d: 125 }, lid: 0, spin: 0.08, world: 0, y: 70, labels: ["lid"] },
      { title: "A lid over the active site", dur: 9,
        body: (c) => `<p>In water the lid (residues 82–96, a short helix) lies shut. Trp89 sits ${f1(c.m.trpSer)} Å from the catalytic serine, so no fat can reach it.</p><p class="small">The ribbon turns to glass to show the three catalytic residues under the lid.</p>`,
        cam: { az: 170, el: -38, d: 95 }, lid: 0, world: 0, y: 70, glass: 0.26, sticks: 1, labels: ["lid", "ser", "his", "asp"] },
    ],
  },
  {
    id: "oil", short: "At the oil", kicker: "02 · Interfacial activation",
    steps: [
      { title: "A droplet of used cooking oil", dur: 8,
        body: () => `<p>Below is a droplet of waste cooking oil: mostly triglycerides, three fatty-acid chains on a glycerol. Lipase works at the boundary between the oil and the water, not inside either.</p>`,
        predict: { q: "When the enzyme touches the oil, what does the lid do?", options: [["a", "Stays shut"], ["b", "Swings open"], ["c", "Falls off"]], answer: "b", why: "It swings open: next step." },
        cam: { az: 200, el: 10, d: 175, ty: 20 }, lid: 0, world: 1, y: 34, labels: ["lid", "oil"], bar: 50 },
      { title: "At the interface the lid opens", dur: 10,
        body: (c) => `<p>Touching the oil, the lid swings open. Measured between the two crystal structures, Glu87 moves ${f1(c.m.glu87)} Å and Gly91 ${f1(c.m.gly91)} Å; the rest of the enzyme stays put (core RMSD ${c.m.rmsd} Å).</p><p class="small">This switch on contact with an interface is <i>interfacial activation</i>.</p>`,
        cam: { az: 215, el: 6, d: 120, ty: 8 }, lid: 1, world: 1, y: 2, labels: ["lid", "oil"], bar: 20 },
      { title: "An oily face, pressed into the oil", dur: 10,
        body: () => `<p>Seen from the oil side, the surface is coloured by amino acid: <b class="hy">water-avoiding</b> (Leu, Ile, Val, Phe, Trp…) or <b class="po">water-loving</b>. Opening the lid turns its water-avoiding side outward, so this face sinks into the oil, with the active site at its centre.</p>`,
        cam: { az: 190, el: -48, d: 125, ty: 30 }, lid: 1, world: 0, y: 30, surface: 1, labels: ["patch"], bar: 20 },
    ],
  },
  {
    id: "site", short: "Active site", kicker: "03 · The catalytic triad",
    steps: [
      { title: "Ser146, His258, Asp201", dur: 10,
        body: (c) => `<p>Deep in the open site sit three residues that work as one. Asp201 holds His258 (${f1(c.m.hisAsp)} Å); His258 sits ${f1(c.m.serHis)} Å from Ser146’s oxygen, ready to take its proton.</p><p class="small">Ser146 sits in the G-X-S-X-G motif (GHSLG) at the tip of a sharp turn, the “nucleophilic elbow” of the α/β-hydrolase fold.</p>`,
        cam: { focus: "site", az: 160, el: 20, d: 30 }, lid: 1, world: 0, y: 2, glass: 0.3, sticks: 1, labels: ["ser", "his", "asp", "dSH", "dHA"] },
      { title: "The oxyanion hole", dur: 9,
        body: () => `<p>Two backbone N–H groups, from Leu147 and Ser83, point at the spot where the substrate’s carbonyl oxygen will sit. When that oxygen turns negative during the reaction, they hold it: the oxyanion hole.</p>`,
        cam: { focus: "site", az: 120, el: 10, d: 26 }, lid: 1, world: 0, y: 2, glass: 0.3, sticks: 1, labels: ["ser", "his", "oxL", "oxS"] },
    ],
  },
  {
    id: "react", short: "Reaction", kicker: "04 · Oil + methanol → biodiesel", player: true,
    steps: STEPS.map((s, i) => ({
      title: s.t, dur: STEP_DUR[i] + 1.2, react: i,
      body: () => `<p>${s.s}</p>`,
      cam: { focus: "site", az: [150, 152, 156, 160, 166, 160, 170, 160][i], el: [24, 22, 20, 22, 24, 20, 26, 22][i], d: [40, 34, 30, 36, 36, 30, 42, 34][i] },
      lid: 1, world: 0, y: 2, glass: 0.22, sticks: 1,
      labels: [["ser", "his"], ["ser", "his", "c"], ["ox", "ser"], ["ser", "dg"], ["meoh"], ["ox", "meoh"], ["prod"], ["ser"]][i],
    })),
  },
  {
    id: "cond", short: "Conditions", kicker: "05 · What sets the rate",
    steps: [
      { title: "pH, heat, ions, mixing, methanol", dur: 21, bench: true,
        body: () => `<p>Pick a case or move a control. pH, heat and ions use one lipase, <i>Staphylococcus caprae</i> NCU S6 (Zhao et al. 2021), the slide’s data.</p><p class="small">Watch the enzyme: gold biodiesel leaves faster or slower, heat loosens the lid, acid parks a proton on His258, ions settle, methanol shock greys it, stirring ripples the oil. Illustrative.</p>`,
        cam: { az: 205, el: 8, d: 120, ty: 6 }, lid: 1, world: 1, y: 2, glass: 0.62, sticks: 1, labels: [], tour: ["best", "acid", "hot", "metal", "meoh", "best"] },
    ],
  },
  {
    id: "scale", short: "Reactor", kicker: "06 · From molecule to reactor",
    steps: [
      { title: "Fixed on a carrier", dur: 8, level: "carrier", labels: ["cEnz", "cCar"],
        body: () => `<p>In industry the lipase is immobilised: adsorbed on a porous, water-avoiding carrier, it sits lid-open as if on oil. It can then be reused for many batches. Novozym 435 (<i>C. antarctica</i> lipase B on an acrylic resin) kept over 95 % conversion through 50 cycles in Shimada’s three-step process.</p>` },
      { title: "One carrier bead", dur: 8, level: "bead", labels: ["bOil", "bPore"],
        body: () => `<p>Each bead is a few hundred micrometres across and carries millions of enzyme molecules inside its pores. The oil and methanol soak in; biodiesel and glycerol come out.</p>` },
      { title: "A packed-bed reactor", dur: 10, level: "reactor", labels: ["rFeed", "rBed", "rFame", "rGly"],
        body: () => `<p>Packed into a column, the beads turn a stream of used cooking oil and methanol into biodiesel. In the settler the biodiesel floats on the denser glycerol. Glycerol can also coat the beads and slow them: one reason processes wash or use a co-solvent.</p><p class="small">Column and beads are illustrative; beads drawn about six times larger than life.</p>` },
    ],
  },
];
