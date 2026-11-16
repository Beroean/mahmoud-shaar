/**
 * The drawings for the opening scene (GateIntro.tsx), as SVG markup strings so they can also be
 * rendered to PNG while designing. Two views of the entrance of the Citadel of Aleppo, in the
 * site's gold-on-ink line style, drawn from photographs:
 *
 * - PANORAMA: the side view. The stepped outer tower, the bridge on its tall narrow arches climbing
 *   across the moat, the great inner gate block, the paved glacis of the mound and the walls above.
 * - FACADE: the inner gate head-on. The battered, crenellated block, its plain pointed arch, three
 *   box machicolations either side, the inscription band, the row of grilled windows and the ornate
 *   central window of the throne hall, and the steps up to the door.
 */

const GOLD = "#c9a96e";
const LIT = "#1c1811";
const SHADE = "#12100c";
const DARK = "#070706";

const f = (n: number) => Math.round(n * 10) / 10;
const pts = (p: number[][]) => p.map((q) => `${f(q[0])} ${f(q[1])}`).join("L");
const lerp = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/* ------------------------------------------------------------------ panorama (800 × 500) */

export const PANORAMA_VIEWBOX = "0 0 800 500";
/** Where the gate's arch is in the panorama, as fractions (the zoom's transform-origin). */
export const PANORAMA_FOCUS = { x: 0.535, y: 0.585 };

let order = 0;
/** A filled shape whose outline is drawn on (class gd) and whose fill fades in (class gf). */
function shape(d: string, fill: string, opts: { o?: number; w?: number; nofill?: boolean } = {}): string {
  const delay = `style="animation-delay:${(order++ * 0.022).toFixed(2)}s"`;
  const fillEl = opts.nofill ? "" : `<path class="gf" d="${d}" fill="${fill}" ${delay}/>`;
  return `${fillEl}<path class="gd" pathLength="1" d="${d}" fill="none" stroke="${GOLD}" stroke-opacity="${opts.o ?? 0.75}" stroke-width="${opts.w ?? 1.3}" stroke-linejoin="round" stroke-linecap="round" ${delay}/>`;
}
const line = (d: string, o = 0.5, w = 1.1) => shape(d, "none", { o, w, nofill: true });

/** Merlons along a straight edge from a to b (drawn above it). */
function merlons(a: number[], b: number[], n: number, h: number): string {
  let d = "";
  for (let i = 0; i < n; i++) {
    const p = lerp(a, b, (i + 0.15) / n);
    const q = lerp(a, b, (i + 0.7) / n);
    d += `M${pts([p, [p[0], p[1] - h], [q[0], q[1] - h], q])}`;
  }
  return d;
}

function panorama(): string {
  order = 0;
  const out: string[] = [];
  const GROUND = 446;

  // Sky: a warm glow low behind the mound, a few stars, a thin crescent.
  out.push(
    `<defs><radialGradient id="gp-glow" cx="0.45" cy="1" r="0.8"><stop offset="0" stop-color="${GOLD}" stop-opacity="0.13"/><stop offset="1" stop-color="${GOLD}" stop-opacity="0"/></radialGradient></defs>`,
    `<rect class="gf" width="800" height="${GROUND}" fill="url(#gp-glow)"/>`,
    `<g class="gf" fill="${GOLD}">${[[70, 60, 1.2], [150, 110, 0.9], [215, 42, 1], [560, 70, 1.1], [615, 150, 0.8], [770, 110, 1], [520, 30, 0.8], [705, 44, 0.9], [40, 170, 0.8]]
      .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" opacity="0.55"/>`)
      .join("")}</g>`,
    `<path class="gf" d="M664 62a22 22 0 1 0 22 30a17 17 0 1 1-22-30z" fill="${GOLD}" fill-opacity="0.5"/>`,
  );

  // The mound: paved glacis rising to the walls. Its right flank drops into the moat under the bridge.
  const mound = `M-10 ${GROUND}L-10 262L250 300L352 332L500 346L604 ${GROUND}Z`;
  out.push(shape(mound, "#0f0e0b", { o: 0.45 }));
  // Paving courses on the glacis.
  let courses = "";
  for (let i = 1; i <= 6; i++) courses += `M-10 ${262 + i * 27}L${250 + i * 20} ${300 + i * 22}L${352 + i * 38} ${332 + i * 17.5}`;
  out.push(`<path class="gf" d="${courses}" fill="none" stroke="${GOLD}" stroke-opacity="0.1" stroke-width="1"/>`);

  // Walls and towers along the top of the mound (behind the gate block).
  out.push(shape("M-10 262V196H40V262Z", SHADE, { o: 0.5 }), line(merlons([-10, 196], [40, 196], 3, 7), 0.45));
  out.push(shape("M40 262V214L128 222V282Z", SHADE, { o: 0.4 }), line(merlons([40, 214], [128, 222], 6, 6), 0.35));
  out.push(shape("M128 286V182H178V292Z", LIT, { o: 0.55 }), line(merlons([128, 182], [178, 182], 4, 7), 0.5));
  out.push(shape("M178 292V226L250 236V300Z", SHADE, { o: 0.4 }), line(merlons([178, 226], [250, 236], 5, 6), 0.35));
  out.push(line("M150 214v14M150 244v12M8 222v14", 0.4));

  // The inner gate block, seen from its corner. Left: the long side face. Right: the front, with the arch.
  const K = [362, 92]; // top of the near corner
  const KB = [352, 334]; // its foot (the walls are battered)
  const LT = [250, 136];
  const LB = [246, 302];
  const RT = [500, 142];
  const RB = [504, 348];
  out.push(shape(`M${pts([LT, K, KB, LB])}Z`, SHADE));
  out.push(shape(`M${pts([K, RT, RB, KB])}Z`, LIT));
  out.push(line(merlons(LT, K, 7, 8), 0.6), line(merlons(K, RT, 8, 8), 0.6));

  // Points on the front face: u along the top/bottom edges (0 = corner), v down the face.
  const front = (u: number, v: number) => lerp(lerp(K, RT, u), lerp(KB, RB, u), v);
  const side = (u: number, v: number) => lerp(lerp(K, LT, u), lerp(KB, LB, u), v);
  const quad = (fn: (u: number, v: number) => number[], u0: number, u1: number, v0: number, v1: number) =>
    `M${pts([fn(u0, v0), fn(u1, v0), fn(u1, v1), fn(u0, v1)])}Z`;

  // The arch: a tall pointed opening in the middle of the front face.
  const aL = 0.4;
  const aR = 0.66;
  const apex = front((aL + aR) / 2, 0.47);
  const sl = front(aL, 0.66);
  const sr = front(aR, 0.66);
  const arch = `M${pts([front(aL, 1)])}L${pts([sl])}Q${pts([front(aL, 0.5)])} ${pts([apex])}Q${pts([front(aR, 0.5)])} ${pts([sr])}L${pts([front(aR, 1)])}Z`;
  out.push(shape(arch, DARK, { o: 0.85 }));

  // Machicolations at the level of the arch's head: two on the front either side, two on the side face.
  for (const [u0, u1] of [[0.06, 0.17], [0.22, 0.33], [0.73, 0.83], [0.88, 0.97]]) {
    out.push(shape(quad(front, u0, u1, 0.47, 0.57), SHADE, { o: 0.7, w: 1.1 }));
    out.push(line(`M${pts([front(u0 + 0.02, 0.57), front(u0 + 0.02, 0.62)])}M${pts([front((u0 + u1) / 2, 0.57), front((u0 + u1) / 2, 0.62)])}M${pts([front(u1 - 0.02, 0.57), front(u1 - 0.02, 0.62)])}`, 0.5, 1));
  }
  for (const [u0, u1] of [[0.12, 0.26], [0.5, 0.64]]) {
    out.push(shape(quad(side, u0, u1, 0.49, 0.59), DARK, { o: 0.6, w: 1.1 }));
    out.push(line(`M${pts([side(u0 + 0.03, 0.59), side(u0 + 0.03, 0.64)])}M${pts([side(u1 - 0.03, 0.59), side(u1 - 0.03, 0.64)])}`, 0.4, 1));
  }
  // Upper windows: the row of the throne hall on the front, a few on the side.
  for (const u of [0.12, 0.3, 0.72, 0.9]) out.push(shape(quad(front, u - 0.03, u + 0.03, 0.26, 0.35), DARK, { o: 0.6, w: 1 }));
  out.push(shape(quad(front, 0.45, 0.61, 0.1, 0.4), "none", { o: 0.45, w: 1, nofill: true }));
  out.push(shape(quad(front, 0.495, 0.565, 0.22, 0.36), DARK, { o: 0.65, w: 1 }));
  for (const u of [0.2, 0.42, 0.66, 0.86]) out.push(shape(quad(side, u - 0.025, u + 0.025, 0.24, 0.31), DARK, { o: 0.45, w: 1 }));
  // Inscription band and arrow slits.
  out.push(line(`M${pts([front(0, 0.72), front(aL, 0.72)])}M${pts([front(aR, 0.72), front(1, 0.72)])}M${pts([side(0, 0.74), side(1, 0.74)])}`, 0.3, 1));
  out.push(line(`M${pts([front(0.2, 0.8), front(0.2, 0.86)])}M${pts([front(0.84, 0.8), front(0.84, 0.86)])}M${pts([side(0.3, 0.82), side(0.3, 0.88)])}M${pts([side(0.7, 0.82), side(0.7, 0.88)])}`, 0.4, 1));

  // The bridge: its deck climbs from the outer tower (right) to the door; tall narrow arches below.
  const d0 = [front(aR, 1)[0] + 6, front(aR, 1)[1] - 2]; // at the gate
  const d1 = [652, 384]; // at the outer tower
  const deckTop = (t: number) => lerp(d0, d1, t);
  const PARAPET = 15;
  const body = `M${pts([d0, d1, [d1[0], GROUND], [540, GROUND], [d0[0], d0[1] + 46]])}Z`;
  out.push(shape(body, "#17140f", { o: 0.7 }));
  out.push(line(`M${pts([[d0[0], d0[1] + PARAPET], [d1[0], d1[1] + PARAPET]])}`, 0.55));
  out.push(line(merlons(d0, d1, 11, 5), 0.4, 1));
  // Arches: each opening rises to just under the parapet and drops to the moat.
  const N = 7;
  for (let i = 0; i < N; i++) {
    const t0 = 0.1 + (i * 0.86) / N;
    const t1 = t0 + 0.07;
    const a = deckTop(t0);
    const b = deckTop(t1);
    const top = Math.min(a[1], b[1]) + PARAPET + 8;
    const footA = Math.min(GROUND, d0[1] + 46 + (GROUND - d0[1] - 46) * Math.min(1, (a[0] - d0[0]) / (540 - d0[0])));
    const footB = Math.min(GROUND, d0[1] + 46 + (GROUND - d0[1] - 46) * Math.min(1, (b[0] - d0[0]) / (540 - d0[0])));
    const r = (b[0] - a[0]) / 2;
    out.push(shape(`M${f(a[0])} ${f(footA)}V${f(top + r)}A${f(r)} ${f(r)} 0 0 1 ${f(b[0])} ${f(top + r + (b[1] - a[1]))}V${f(footB)}Z`, DARK, { o: 0.6, w: 1.1 }));
  }

  // The outer gate tower: a tall block with a stepped, crenellated shoulder down to the bridge.
  const tower = `M652 ${GROUND}V384L652 356H668V326H684V296H700V262H770V${GROUND}Z`;
  out.push(shape(tower, LIT));
  out.push(shape(`M770 262L790 274V${GROUND}H770Z`, SHADE, { o: 0.5 }));
  out.push(line(merlons([700, 262], [770, 262], 5, 9), 0.6));
  out.push(line("M652 356v-7h7v7M668 326v-7h7v7M684 296v-7h7v7", 0.5, 1));
  out.push(shape("M722 300h14v18h-14z", DARK, { o: 0.6, w: 1 }), shape("M703 336h30v12h-30z", SHADE, { o: 0.55, w: 1 }));
  out.push(line("M708 348v6M718 348v6M728 348v6M745 372v14M690 392v14", 0.45, 1));
  out.push(line("M735 250V226M735 226l14 5-14 5", 0.55, 1));

  // Ground.
  out.push(line(`M-10 ${GROUND}H810`, 0.5));
  return out.join("");
}

export const PANORAMA = panorama();

/* ------------------------------------------------------------------ facade (400 × 560) */

export const FACADE_VIEWBOX = "0 0 400 560";

/** The doorway: jambs, spring line and radius of the pointed arch; the doors stand on the top step. */
export const ARCH = { left: 150, right: 250, spring: 345, radius: 108, sill: 520 };
export const ARCH_APEX = ARCH.spring - Math.sqrt(ARCH.radius ** 2 - ((ARCH.right - ARCH.left) / 2) ** 2);

const archPath = (grow: number) => {
  const l = ARCH.left - grow;
  const r = ARCH.right + grow;
  const R = ARCH.radius + grow;
  const top = ARCH.spring - Math.sqrt(R * R - 50 * 50);
  return `M${l} ${ARCH.sill}V${ARCH.spring}A${R} ${R} 0 0 1 200 ${f(top)}A${R} ${R} 0 0 1 ${r} ${ARCH.spring}V${ARCH.sill}`;
};

const TOP = 80;
/** Left edge of the battered block at height y (the right edge mirrors it). */
const edge = (y: number) => 36 - ((y - TOP) * 20) / 480;

function facade(): string {
  const out: string[] = [];
  const s = (o: number, w = 1.2) => `stroke="${GOLD}" stroke-opacity="${o}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
  const block = `M${edge(560)} 560L${edge(TOP)} ${TOP}H${400 - edge(TOP)}L${400 - edge(560)} 560Z`;
  const cut = `${archPath(0)}Z`;

  out.push(
    `<defs><clipPath id="gf-block"><path d="${block}${cut}" clip-rule="evenodd"/></clipPath>` +
      `<linearGradient id="gf-stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1710"/><stop offset="1" stop-color="#0f0e0b"/></linearGradient>` +
      `<pattern id="gf-grille" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M0 0L5 5M5 0L0 5" stroke="${GOLD}" stroke-opacity="0.45" stroke-width="0.6"/></pattern></defs>`,
  );

  // Stars, and the lower walls and glacis either side of the block.
  out.push(
    `<g fill="${GOLD}" opacity="0.5">${[[22, 40, 1], [70, 22, 0.8], [340, 30, 1], [378, 58, 0.8], [130, 48, 0.7], [270, 18, 0.8]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join("")}</g>`,
    `<path d="M-6 300H${edge(300)}V470L-6 510Z" fill="#100f0c" ${s(0.3, 1)}/>`,
    `<path d="M406 330H${400 - edge(330)}V470L406 510Z" fill="#100f0c" ${s(0.3, 1)}/>`,
    `<path d="M-6 300v-8h7v8M8 300v-8h7v8M406 330v-8h-7v8M392 330v-8h-7v8" fill="none" ${s(0.3, 1)}/>`,
  );

  // The block, with crenellations and the small box above the central window.
  let crown = "";
  for (let x = edge(TOP) + 3; x < 400 - edge(TOP) - 12; x += 21.4) crown += `M${f(x)} ${TOP}v-10h13v10`;
  out.push(
    `<path d="${block}${cut}" fill="url(#gf-stone)" fill-rule="evenodd" ${s(0.6, 1.3)}/>`,
    `<path d="${crown}" fill="#17140f" ${s(0.5, 1.1)}/>`,
    `<path d="M190 ${TOP - 10}v-9h20v9" fill="#17140f" ${s(0.55, 1.1)}/><path d="M193 ${TOP}v5M200 ${TOP}v5M207 ${TOP}v5" ${s(0.45, 1)}/>`,
  );

  // Stone courses, clipped to the block.
  let courses = "";
  for (let y = TOP + 20, row = 0; y < 560; y += 20, row++) {
    courses += `M0 ${y}H400`;
    for (let x = row % 2 ? 22 : 44; x < 400; x += 44) courses += `M${x} ${y}v20`;
  }
  out.push(`<g clip-path="url(#gf-block)"><path d="${courses}" fill="none" ${s(0.075, 1)}/></g>`);

  // Throne-hall storey. Centre: a tall framed panel with a small arched window, a lattice band,
  // striped (ablaq) courses and the big grilled window.
  out.push(
    `<rect x="170" y="100" width="60" height="138" fill="#15120d" ${s(0.5, 1.1)}/>`,
    `<rect x="176" y="106" width="48" height="126" fill="none" ${s(0.25, 0.8)}/>`,
    `<path d="M194 146v-12q0-7 6-9q6 2 6 9v12z" fill="${DARK}" ${s(0.6, 1)}/>`,
    `<rect x="182" y="152" width="36" height="9" fill="url(#gf-grille)" ${s(0.4, 0.8)}/>`,
    [0, 1, 2, 3, 4].map((i) => `<rect x="182" y="${166 + i * 3.2}" width="36" height="3.2" fill="${i % 2 ? "#0c0b09" : "#3a3020"}"/>`).join(""),
    `<rect x="182" y="166" width="36" height="16" fill="none" ${s(0.4, 0.8)}/>`,
    `<rect x="185" y="188" width="30" height="38" fill="${DARK}" ${s(0.65, 1.1)}/><rect x="185" y="188" width="30" height="38" fill="url(#gf-grille)"/>`,
  );
  // Either side: a small arched window high up, a niche with its little corbelled box, and three
  // grilled windows (the middle one under striped courses).
  for (const m of [1, -1]) {
    const x = (dx: number) => 200 + m * dx;
    out.push(
      `<path d="M${x(88) - 6} 142v-11q0-7 6-9q6 2 6 9v11z" fill="${DARK}" ${s(0.55, 1)}/>`,
      `<path d="M${x(124) - 6} 162v-24q0-6 6-8q6 2 6 8v24z" fill="#0c0b09" ${s(0.4, 1)}/>`,
      `<path d="M${x(124) - 5} 162h10v7h-10zM${x(124) - 3} 169v4M${x(124) + 3} 169v4" fill="#17140f" ${s(0.45, 0.9)}/>`,
    );
    for (const dx of [62, 100, 138]) {
      out.push(`<rect x="${x(dx) - 9}" y="208" width="18" height="24" fill="${DARK}" ${s(0.55, 1)}/><rect x="${x(dx) - 9}" y="208" width="18" height="24" fill="url(#gf-grille)"/>`);
    }
    out.push(
      [0, 1, 2, 3].map((i) => `<rect x="${x(100) - 15}" y="${192 + i * 3.4}" width="30" height="3.4" fill="${i % 2 ? "#0c0b09" : "#3a3020"}"/>`).join(""),
      `<rect x="${x(100) - 15}" y="192" width="30" height="13.6" fill="none" ${s(0.35, 0.8)}/>`,
    );
    // Arrow slits.
    out.push(`<path d="M${x(72)} 268v14M${x(150)} 276v12M${x(112)} 430v16M${x(160)} 470v16M${x(76)} 500v16" ${s(0.4, 1)}/>`);
    // Three box machicolations on their corbels.
    for (const dx of [80, 118, 156]) {
      const c = x(dx);
      out.push(
        `<path d="M${c - 17} 300h34v36h-34z" fill="#17140f" ${s(0.6, 1.1)}/>`,
        `<path d="M${c - 19} 298h38" ${s(0.5, 1.1)}/>`,
        `<path d="M${c - 15} 336v10h7v-10M${c - 3.5} 336v10h7v-10M${c + 8} 336v10h7v-10" fill="#100f0c" ${s(0.45, 0.9)}/>`,
        `<path d="M${c - 11} 312v12M${c} 312v12M${c + 11} 312v12" ${s(0.25, 0.8)}/>`,
      );
    }
    // Inscription band.
    const a = m === 1 ? 262 : edge(392) + 2;
    const b = m === 1 ? 400 - edge(392) - 2 : 138;
    out.push(`<path d="M${f(a)} 388H${f(b)}M${f(a)} 396H${f(b)}" ${s(0.35, 0.9)}/><path d="M${f(a + 2)} 392H${f(b - 2)}" ${s(0.3, 2.2)} stroke-dasharray="2.5 2"/>`);
  }

  // The arch: plain, with a second line for the depth of the recess.
  out.push(`<path d="${archPath(7)}" fill="none" ${s(0.4, 1)}/><path d="${archPath(0)}" fill="none" ${s(0.85, 1.4)}/>`);

  // Steps up to the door, between low parapet walls.
  for (let i = 0; i < 4; i++) {
    const y = ARCH.sill + i * 10;
    const w = 50 + i * 12;
    out.push(`<path d="M${200 - w} ${y}H${200 + w}v10H${200 - w}z" fill="${i % 2 ? "#14120e" : "#191610"}" ${s(0.5, 1)}/>`);
  }
  out.push(
    `<path d="M150 ${ARCH.sill}L102 560H86L140 ${ARCH.sill - 22}V${ARCH.sill}z" fill="#17140f" ${s(0.5, 1)}/>`,
    `<path d="M250 ${ARCH.sill}L298 560H314L260 ${ARCH.sill - 22}V${ARCH.sill}z" fill="#17140f" ${s(0.5, 1)}/>`,
  );
  return out.join("");
}

export const FACADE = facade();

/** One door leaf in facade coordinates; `viewBox` crops to its half of the doorway. */
export function leaf(sideOf: "l" | "r"): { viewBox: string; svg: string } {
  const { left, right, spring, radius: R, sill } = ARCH;
  const x0 = sideOf === "l" ? left : 200;
  const outline =
    sideOf === "l" ? `M${left} ${sill}V${spring}A${R} ${R} 0 0 1 200 ${f(ARCH_APEX)}V${sill}Z` : `M200 ${f(ARCH_APEX)}A${R} ${R} 0 0 1 ${right} ${spring}V${sill}H200Z`;
  const id = `gl-${sideOf}`;
  let planks = "";
  for (let dx = 10; dx < 50; dx += 10) planks += `M${x0 + dx} ${f(ARCH_APEX)}V${sill}`;
  let bands = "";
  for (const y of [372, 428, 484]) {
    bands += `<path d="M${x0} ${y}h50" stroke="${GOLD}" stroke-opacity="0.55" stroke-width="2.4"/>`;
    for (const dx of [5, 15, 25, 35, 45]) bands += `<circle cx="${x0 + dx}" cy="${y}" r="1.4" fill="${GOLD}" fill-opacity="0.8"/>`;
  }
  for (let y = 300; y < sill; y += 28) if (![372, 428, 484].includes(y)) for (const dx of [5, 25, 45]) bands += `<circle cx="${x0 + dx}" cy="${y}" r="0.9" fill="${GOLD}" fill-opacity="0.45"/>`;
  const ringX = sideOf === "l" ? 193 : 207;
  const svg =
    `<defs><clipPath id="${id}"><path d="${outline}"/></clipPath></defs>` +
    `<path d="${outline}" fill="#261b0f"/>` +
    `<g clip-path="url(#${id})"><path d="${planks}" fill="none" stroke="${GOLD}" stroke-opacity="0.2" stroke-width="0.8"/>${bands}</g>` +
    `<circle cx="${ringX}" cy="446" r="4" fill="none" stroke="${GOLD}" stroke-opacity="0.85" stroke-width="1.2"/>` +
    `<path d="${outline}" fill="none" stroke="${GOLD}" stroke-opacity="0.7" stroke-width="1.2"/>`;
  return { viewBox: `${x0} ${f(ARCH_APEX)} 50 ${f(sill - ARCH_APEX)}`, svg };
}
