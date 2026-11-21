/**
 * Generates the 24 flat product illustrations in public/products/*.svg.
 *
 * Every illustration shares one frame (category-coloured background, a lighter
 * halo circle and a soft floor shadow), one palette and one light direction
 * (each solid shape gets a darker right-hand side and a soft top-left
 * highlight), so the catalog reads as a single curated set.
 *
 * Run: npm run illustrations
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const P = {
  ink: "#1F2A24",
  clay: "#C0754A",
  clayDark: "#9C5A36",
  green: "#3F7464",
  greenDark: "#2F5A4D",
  greenLight: "#7FA898",
  sand: "#D8B98F",
  sandDark: "#B9976C",
  wood: "#B9875A",
  cream: "#FBF6EE",
  creamDark: "#EADFCC",
  mustard: "#D9A441",
  lilac: "#8D7BAA",
  lilacDark: "#6E5C8F",
  glass: "#CFE3DC",
};

export const CATEGORY_BG: Record<string, string> = {
  home: "#E8D9C4",
  kitchen: "#D9E4D6",
  stationery: "#E4DCEB",
  bags: "#F1D9C9",
};

let clipId = 0;
let idPrefix = "";

/**
 * A solid shape with the shared lighting: base fill, a darker right side
 * (clipped to the shape) and a soft highlight on the upper left.
 * `el` is a single SVG shape element without a fill, e.g. `<rect .../>`.
 */
function solid(el: string, fill: string, shadeFromX = 300, highlight = true): string {
  const id = `${idPrefix}-c${++clipId}`;
  const filled = el.replace(/\/>$/, ` fill="${fill}"/>`);
  return [
    filled,
    `<clipPath id="${id}">${el}</clipPath>`,
    `<g clip-path="url(#${id})">`,
    `<rect x="${shadeFromX}" y="0" width="600" height="600" fill="${P.ink}" opacity="0.13"/>`,
    highlight
      ? `<ellipse cx="${shadeFromX - 70}" cy="120" rx="60" ry="240" fill="#FFFFFF" opacity="0.14" transform="rotate(18 ${shadeFromX - 70} 300)"/>`
      : "",
    `</g>`,
  ].join("");
}

const flat = (el: string, fill: string, extra = "") =>
  el.replace(/\/>$/, ` fill="${fill}"${extra ? " " + extra : ""}/>`);

const stroke = (d: string, color: string, width: number, extra = "") =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;

function frame(category: string, body: string, shadowRx = 150): string {
  const bg = CATEGORY_BG[category];
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">`,
    `<rect width="600" height="600" fill="${bg}"/>`,
    `<circle cx="300" cy="290" r="205" fill="#FFFFFF" opacity="0.32"/>`,
    `<ellipse cx="300" cy="474" rx="${shadowRx}" ry="16" fill="${P.ink}" opacity="0.10"/>`,
    body,
    `</svg>`,
  ].join("");
}

const leaf = (cx: number, cy: number, rx: number, ry: number, angle: number, fill = P.green) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" transform="rotate(${angle} ${cx} ${cy})"/>`;

type Drawing = { category: string; shadow?: number; draw: () => string };

export const ILLUSTRATIONS: Record<string, Drawing> = {
  // ---------------------------------------------------------------- home
  "dune-ceramic-vase": {
    category: "home",
    shadow: 110,
    draw: () =>
      stroke("M300 200 C296 160 280 120 262 92", P.greenDark, 5) +
      stroke("M300 200 C306 160 322 130 344 112", P.greenDark, 5) +
      leaf(258, 100, 12, 26, -30, P.green) +
      leaf(282, 132, 10, 22, 35, P.greenLight) +
      leaf(346, 112, 12, 26, 40, P.green) +
      leaf(322, 146, 10, 22, -30, P.greenLight) +
      solid(
        `<path d="M262 190 h76 v20 c0 20 -10 30 -10 46 c0 30 62 60 62 130 c0 50 -30 84 -90 84 s-90 -34 -90 -84 c0 -70 62 -100 62 -130 c0 -16 -10 -26 -10 -46 z"/>`,
        P.clay,
      ) +
      flat(`<rect x="256" y="182" width="88" height="14" rx="7"/>`, P.clayDark) +
      stroke("M232 372 C270 360 330 360 368 372", P.cream, 6, `opacity="0.7"`),
  },
  "lumen-table-lamp": {
    category: "home",
    shadow: 90,
    draw: () =>
      `<circle cx="300" cy="300" r="120" fill="${P.mustard}" opacity="0.18"/>` +
      solid(`<rect x="293" y="250" width="14" height="196" rx="7"/>`, P.ink) +
      solid(`<path d="M246 470 h108 l-16 -30 h-76 z"/>`, P.sandDark) +
      solid(`<path d="M214 266 L386 266 L352 140 L248 140 Z"/>`, P.green) +
      flat(`<rect x="214" y="258" width="172" height="12" rx="6"/>`, P.greenDark) +
      flat(`<ellipse cx="300" cy="278" rx="54" ry="8"/>`, P.mustard, `opacity="0.75"`),
  },
  "reed-linen-cushion": {
    category: "home",
    shadow: 170,
    draw: () => {
      const d =
        "M190 250 Q300 226 410 250 Q432 350 410 450 Q300 474 190 450 Q168 350 190 250 Z";
      const id = `${idPrefix}-c${++clipId}`;
      return (
        solid(`<path d="${d}"/>`, P.sand) +
        `<clipPath id="${id}"><path d="${d}"/></clipPath>` +
        `<g clip-path="url(#${id})" opacity="0.85">` +
        flat(`<rect x="150" y="300" width="300" height="14"/>`, P.clay) +
        flat(`<rect x="150" y="326" width="300" height="6"/>`, P.clay) +
        flat(`<rect x="150" y="386" width="300" height="6"/>`, P.clay) +
        flat(`<rect x="150" y="400" width="300" height="14"/>`, P.clay) +
        `</g>` +
        flat(`<circle cx="300" cy="350" r="12"/>`, P.clayDark)
      );
    },
  },
  "ember-soy-candle": {
    category: "home",
    shadow: 110,
    draw: () =>
      `<circle cx="300" cy="222" r="46" fill="${P.mustard}" opacity="0.22"/>` +
      solid(`<rect x="214" y="280" width="172" height="190" rx="26"/>`, P.green) +
      flat(`<ellipse cx="300" cy="298" rx="76" ry="14"/>`, P.cream) +
      flat(`<rect x="214" y="352" width="172" height="58"/>`, P.sand) +
      flat(`<circle cx="300" cy="381" r="14"/>`, P.clay) +
      stroke("M300 298 L300 268", P.ink, 4) +
      solid(`<path d="M300 210 C318 236 316 262 300 268 C284 262 282 236 300 210 Z"/>`, P.mustard, 304, false) +
      flat(`<path d="M300 236 C307 248 306 260 300 263 C294 260 293 248 300 236 Z"/>`, P.cream),
  },
  "oasis-stoneware-planter": {
    category: "home",
    shadow: 120,
    draw: () =>
      leaf(268, 230, 26, 80, -28) +
      leaf(334, 222, 26, 86, 26, P.greenLight) +
      leaf(300, 196, 24, 96, 2, P.greenDark) +
      leaf(240, 284, 20, 60, -60, P.greenLight) +
      leaf(362, 282, 20, 60, 60) +
      solid(`<path d="M226 344 h148 l-22 126 h-104 z"/>`, P.clay) +
      solid(`<rect x="214" y="326" width="172" height="28" rx="10"/>`, P.clayDark) +
      flat(`<circle cx="300" cy="404" r="16"/>`, P.cream, `opacity="0.55"`),
  },
  "tide-wool-throw": {
    category: "home",
    shadow: 160,
    draw: () =>
      solid(`<rect x="176" y="398" width="248" height="72" rx="20"/>`, P.green) +
      flat(`<rect x="176" y="426" width="248" height="10"/>`, P.greenDark) +
      solid(`<rect x="186" y="336" width="228" height="66" rx="20"/>`, P.sand) +
      flat(`<rect x="186" y="362" width="228" height="8"/>`, P.clay, `opacity="0.7"`) +
      solid(`<rect x="196" y="280" width="208" height="60" rx="20"/>`, P.cream) +
      flat(`<rect x="196" y="300" width="208" height="7"/>`, P.clay) +
      flat(`<rect x="196" y="314" width="208" height="4"/>`, P.clay) +
      [0, 1, 2, 3, 4, 5]
        .map((i) => stroke(`M${424} ${408 + i * 11} l16 0`, P.greenDark, 4))
        .join(""),
  },
  // ---------------------------------------------------------------- kitchen
  "delta-pour-over-kettle": {
    category: "kitchen",
    shadow: 160,
    draw: () =>
      stroke("M378 330 C462 318 466 446 396 444", P.ink, 16) +
      solid(`<path d="M214 444 C130 396 150 320 116 288 L128 278 C170 312 162 384 228 410 Z"/>`, P.ink, 600, false) +
      solid(`<path d="M196 470 L404 470 C404 360 372 296 300 296 C228 296 196 360 196 470 Z"/>`, P.clay) +
      flat(`<ellipse cx="300" cy="300" rx="62" ry="12"/>`, P.clayDark) +
      flat(`<circle cx="300" cy="282" r="14"/>`, P.ink) +
      flat(`<rect x="196" y="452" width="208" height="18" rx="4"/>`, P.clayDark),
  },
  "basalt-stoneware-mug": {
    category: "kitchen",
    shadow: 130,
    draw: () =>
      stroke("M266 270 C252 246 280 230 266 206", P.cream, 7, `opacity="0.9"`) +
      stroke("M306 266 C292 240 320 222 306 196", P.cream, 7, `opacity="0.9"`) +
      stroke("M366 338 C434 338 434 432 366 432", P.creamDark, 24) +
      solid(`<rect x="206" y="300" width="166" height="170" rx="26"/>`, P.cream) +
      flat(`<rect x="206" y="300" width="166" height="40" rx="20"/>`, P.ink) +
      flat(`<rect x="206" y="320" width="166" height="20"/>`, P.ink) +
      [
        [240, 378],
        [262, 412],
        [300, 392],
        [330, 430],
        [344, 370],
        [232, 440],
      ]
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.5" fill="${P.ink}" opacity="0.35"/>`)
        .join(""),
  },
  "grove-olive-wood-board": {
    category: "kitchen",
    shadow: 120,
    draw: () =>
      solid(
        `<path d="M226 200 h148 a40 40 0 0 1 40 40 v190 a40 40 0 0 1 -40 40 h-148 a40 40 0 0 1 -40 -40 v-190 a40 40 0 0 1 40 -40 z M270 200 v-34 a30 30 0 0 1 60 0 v34 z"/>`,
        P.wood,
      ) +
      flat(`<circle cx="300" cy="170" r="12"/>`, "#D9E4D6") +
      stroke("M222 260 C262 280 252 330 290 350 C330 372 340 420 378 432", P.clayDark, 4, `opacity="0.45"`) +
      stroke("M244 236 C270 252 282 268 300 300", P.clayDark, 3, `opacity="0.35"`) +
      stroke("M336 250 C346 300 380 320 384 360", P.clayDark, 3, `opacity="0.35"`) +
      stroke("M258 408 L346 300", P.greenDark, 4) +
      leaf(286, 380, 9, 20, 40) +
      leaf(312, 348, 9, 20, -40, P.greenLight) +
      leaf(330, 320, 9, 20, 40),
  },
  "sahel-salad-bowl": {
    category: "kitchen",
    shadow: 120,
    draw: () =>
      leaf(250, 318, 28, 46, -40, P.greenLight) +
      leaf(300, 304, 30, 52, 0) +
      leaf(352, 318, 28, 46, 40, P.greenLight) +
      `<circle cx="276" cy="326" r="16" fill="${P.clay}"/>` +
      `<circle cx="334" cy="330" r="13" fill="${P.clay}"/>` +
      solid(`<path d="M168 338 h264 c0 82 -56 124 -132 124 s-132 -42 -132 -124 z"/>`, P.sand) +
      flat(`<ellipse cx="300" cy="338" rx="132" ry="14"/>`, P.sandDark) +
      flat(`<rect x="262" y="458" width="76" height="12" rx="6"/>`, P.sandDark) +
      stroke("M200 380 C250 400 350 400 400 380", P.green, 6, `opacity="0.7"`),
  },
  "ibis-enamel-teapot": {
    category: "kitchen",
    shadow: 140,
    draw: () =>
      stroke("M402 340 C470 336 470 430 404 426", P.clayDark, 16) +
      solid(`<path d="M206 400 C164 380 160 330 132 318 L140 304 C182 316 190 360 222 370 Z"/>`, P.cream, 600, false) +
      solid(`<ellipse cx="304" cy="390" rx="118" ry="82"/>`, P.cream) +
      flat(`<path d="M230 322 Q304 286 378 322 Z"/>`, P.clay) +
      flat(`<ellipse cx="304" cy="318" rx="66" ry="12"/>`, P.clay) +
      flat(`<circle cx="304" cy="298" r="14"/>`, P.clayDark) +
      stroke("M206 410 C260 432 348 432 402 410", P.clay, 8) +
      flat(`<rect x="250" y="462" width="108" height="10" rx="5"/>`, P.creamDark),
  },
  "market-glass-carafe": {
    category: "kitchen",
    shadow: 150,
    draw: () =>
      solid(
        `<path d="M250 180 h60 v70 c0 20 50 50 50 120 c0 60 -30 100 -80 100 s-80 -40 -80 -100 c0 -70 50 -100 50 -120 z"/>`,
        P.glass,
        290,
      ) +
      `<path d="M206 380 c4 -10 20 -16 74 -16 s70 6 74 16 c2 50 -26 90 -74 90 s-76 -40 -74 -90 z" fill="${P.green}" opacity="0.35"/>` +
      flat(`<rect x="244" y="172" width="72" height="16" rx="8"/>`, P.greenDark) +
      solid(`<path d="M372 360 h76 l-8 110 h-60 z"/>`, P.glass, 410) +
      `<path d="M376 410 h68 l-4 60 h-60 z" fill="${P.green}" opacity="0.35"/>` +
      stroke("M230 300 C220 330 220 360 226 390", "#FFFFFF", 6, `opacity="0.6"`),
  },
  // ---------------------------------------------------------------- stationery
  "scribe-linen-notebook": {
    category: "stationery",
    shadow: 140,
    draw: () =>
      `<g transform="rotate(-6 300 320)">` +
      flat(`<rect x="214" y="176" width="200" height="290" rx="14"/>`, P.creamDark) +
      solid(`<rect x="200" y="170" width="206" height="292" rx="14"/>`, P.green) +
      flat(`<rect x="200" y="170" width="28" height="292" rx="10"/>`, P.greenDark) +
      flat(`<rect x="366" y="170" width="12" height="292"/>`, P.clay) +
      flat(`<rect x="262" y="230" width="80" height="44" rx="6"/>`, P.cream, `opacity="0.9"`) +
      flat(`<path d="M320 462 L320 506 L332 494 L344 506 L344 462 Z"/>`, P.mustard) +
      `</g>`,
  },
  "atlas-fountain-pen": {
    category: "stationery",
    shadow: 120,
    draw: () =>
      `<g transform="rotate(-38 300 320)">` +
      solid(`<rect x="284" y="200" width="32" height="210" rx="16"/>`, P.ink) +
      solid(`<path d="M286 404 h28 l-4 34 l-10 30 l-10 -30 z"/>`, P.mustard, 300, false) +
      stroke("M300 420 L300 456", P.ink, 3) +
      solid(`<rect x="281" y="140" width="38" height="128" rx="18"/>`, P.lilacDark) +
      flat(`<rect x="312" y="156" width="9" height="92" rx="4"/>`, P.mustard) +
      flat(`<rect x="281" y="256" width="38" height="10"/>`, P.mustard) +
      `</g>` +
      `<path d="M396 440 c10 0 18 8 18 18 s-8 16 -18 16 s-18 -6 -18 -16 s8 -18 18 -18 z" fill="${P.lilacDark}" opacity="0.6"/>`,
  },
  "ledger-desk-planner": {
    category: "stationery",
    shadow: 150,
    draw: () =>
      solid(`<rect x="186" y="196" width="234" height="274" rx="14"/>`, P.cream) +
      flat(`<rect x="186" y="196" width="234" height="62" rx="14"/>`, P.clay) +
      flat(`<rect x="186" y="236" width="234" height="22"/>`, P.clay) +
      [0, 1, 2, 3]
        .map((r) =>
          [0, 1, 2, 3, 4].map(
            (c) =>
              `<rect x="${206 + c * 40}" y="${282 + r * 44}" width="30" height="32" rx="5" fill="${
                r === 1 && c === 2 ? P.green : P.creamDark
              }"/>`,
          ).join(""),
        )
        .join("") +
      [0, 1, 2, 3, 4, 5, 6]
        .map((i) => stroke(`M${214 + i * 30} 182 v34`, P.ink, 6))
        .join(""),
  },
  "meridian-desk-tray": {
    category: "stationery",
    shadow: 170,
    draw: () =>
      `<g transform="rotate(-8 300 380)">` +
      flat(`<rect x="196" y="330" width="210" height="16" rx="8"/>`, P.green) +
      flat(`<path d="M406 330 l26 8 l-26 8 z"/>`, P.ink) +
      `</g>` +
      `<g transform="rotate(6 300 380)">` +
      flat(`<rect x="210" y="350" width="190" height="14" rx="7"/>`, P.mustard) +
      flat(`<path d="M400 350 l22 7 l-22 7 z"/>`, P.ink) +
      `</g>` +
      stroke("M372 344 h28 a8 8 0 0 1 0 16 h-26 a5 5 0 0 1 0 -10 h20", P.ink, 3) +
      solid(`<path d="M150 384 h300 l-20 86 h-260 z"/>`, P.sand) +
      flat(`<rect x="146" y="376" width="308" height="16" rx="8"/>`, P.sandDark),
  },
  "inkwell-ink-bottle": {
    category: "stationery",
    shadow: 120,
    draw: () =>
      solid(`<rect x="222" y="300" width="156" height="170" rx="32"/>`, P.lilac) +
      `<rect x="222" y="360" width="156" height="110" rx="32" fill="${P.lilacDark}" opacity="0.9"/>` +
      flat(`<rect x="250" y="388" width="100" height="50" rx="8"/>`, P.cream, `opacity="0.9"`) +
      solid(`<rect x="262" y="246" width="76" height="60" rx="12"/>`, P.ink) +
      stroke("M276 262 v28 M292 262 v28 M308 262 v28 M324 262 v28", P.cream, 3, `opacity="0.25"`) +
      `<path d="M426 384 c14 20 20 32 20 44 a20 20 0 0 1 -40 0 c0 -12 6 -24 20 -44 z" fill="${P.lilacDark}"/>`,
  },
  "sketch-pencil-cup": {
    category: "stationery",
    shadow: 120,
    draw: () => {
      const pencil = (angle: number, color: string, len: number) =>
        `<g transform="rotate(${angle} 300 420)">` +
        flat(`<rect x="290" y="${420 - len}" width="20" height="${len}"/>`, color) +
        flat(`<path d="M290 ${420 - len} l10 -26 l10 26 z"/>`, P.sand) +
        flat(`<path d="M296 ${420 - len - 16} l4 -10 l4 10 z"/>`, P.ink) +
        `</g>`;
      return (
        pencil(-22, P.green, 210) +
        pencil(-8, P.mustard, 236) +
        pencil(8, P.clay, 220) +
        pencil(22, P.lilacDark, 200) +
        solid(`<rect x="222" y="320" width="156" height="150" rx="20"/>`, P.cream) +
        flat(`<rect x="222" y="350" width="156" height="10"/>`, P.green) +
        flat(`<rect x="222" y="430" width="156" height="10"/>`, P.green)
      );
    },
  },
  // ---------------------------------------------------------------- bags
  "caravan-canvas-tote": {
    category: "bags",
    shadow: 140,
    draw: () =>
      stroke("M236 290 C236 180 300 180 300 236", P.ink, 12) +
      stroke("M364 290 C364 180 300 180 300 236", P.ink, 12) +
      solid(`<path d="M196 280 h208 l22 190 h-252 z"/>`, P.cream) +
      flat(`<path d="M194 300 h212 l3 26 h-218 z"/>`, P.green) +
      solid(`<rect x="248" y="360" width="104" height="76" rx="8"/>`, P.sand, 300, false) +
      flat(`<rect x="248" y="360" width="104" height="12"/>`, P.sandDark),
  },
  "nomad-roll-top-backpack": {
    category: "bags",
    shadow: 120,
    draw: () =>
      stroke("M276 186 C276 156 324 156 324 186", P.greenDark, 10) +
      solid(`<rect x="206" y="190" width="188" height="280" rx="60"/>`, P.green) +
      flat(`<path d="M206 250 C206 200 240 190 300 190 C360 190 394 200 394 250 v12 h-188 z"/>`, P.greenDark) +
      solid(`<rect x="234" y="338" width="132" height="104" rx="26"/>`, P.greenDark, 300, false) +
      stroke("M234 360 h132", P.ink, 3, `opacity="0.35"`) +
      flat(`<rect x="258" y="250" width="16" height="90" rx="6"/>`, P.clay) +
      flat(`<rect x="326" y="250" width="16" height="90" rx="6"/>`, P.clay) +
      flat(`<rect x="254" y="318" width="24" height="18" rx="4"/>`, P.mustard) +
      flat(`<rect x="322" y="318" width="24" height="18" rx="4"/>`, P.mustard),
  },
  "felucca-weekender-duffel": {
    category: "bags",
    shadow: 170,
    draw: () =>
      stroke("M246 340 C246 270 354 270 354 340", P.ink, 12) +
      solid(`<rect x="146" y="330" width="308" height="140" rx="70"/>`, P.clay) +
      flat(`<rect x="196" y="330" width="208" height="14" rx="7"/>`, P.clayDark) +
      stroke("M200 337 h200", P.ink, 3, `stroke-dasharray="6 6" opacity="0.6"`) +
      flat(`<rect x="232" y="330" width="22" height="140"/>`, P.sand) +
      flat(`<rect x="346" y="330" width="22" height="140"/>`, P.sand) +
      flat(`<circle cx="416" cy="337" r="7"/>`, P.mustard),
  },
  "courier-leather-crossbody": {
    category: "bags",
    shadow: 120,
    draw: () =>
      stroke("M228 330 C200 120 400 120 372 330", P.ink, 9) +
      solid(`<rect x="210" y="300" width="180" height="150" rx="28"/>`, P.wood) +
      solid(`<path d="M210 328 C210 310 222 300 240 300 h120 c18 0 30 10 30 28 v52 c-30 22 -150 22 -180 0 z"/>`, P.clayDark, 300, false) +
      flat(`<rect x="290" y="372" width="20" height="28" rx="6"/>`, P.mustard) +
      stroke("M222 440 h156", P.clayDark, 3, `opacity="0.5" stroke-dasharray="5 6"`),
  },
  "papyrus-zip-pouch": {
    category: "bags",
    shadow: 140,
    draw: () =>
      solid(`<rect x="182" y="300" width="236" height="164" rx="40"/>`, P.green) +
      flat(`<rect x="182" y="320" width="236" height="18"/>`, P.greenDark) +
      stroke("M196 329 h208", P.cream, 3, `stroke-dasharray="4 5" opacity="0.8"`) +
      flat(`<rect x="370" y="320" width="16" height="18" rx="3"/>`, P.ink) +
      solid(`<path d="M372 338 h12 l6 40 a12 12 0 0 1 -24 0 z"/>`, P.mustard, 378, false) +
      flat(`<rect x="214" y="380" width="70" height="40" rx="8"/>`, P.cream, `opacity="0.35"`),
  },
  "bazaar-woven-market-bag": {
    category: "bags",
    shadow: 140,
    draw: () => {
      const d = "M202 296 h196 l-16 174 h-164 z";
      const id = `${idPrefix}-c${++clipId}`;
      const h = [0, 1, 2, 3, 4, 5, 6, 7, 8]
        .map((i) => `<rect x="180" y="${300 + i * 20}" width="240" height="8" fill="${P.sandDark}" opacity="0.75"/>`)
        .join("");
      const v = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        .map((i) => `<rect x="${208 + i * 18}" y="290" width="4" height="190" fill="${P.sandDark}" opacity="0.45"/>`)
        .join("");
      return (
        stroke("M244 300 C244 196 356 196 356 300", P.clayDark, 12) +
        solid(`<path d="${d}"/>`, P.sand) +
        `<clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})">${h}${v}</g>` +
        flat(`<rect x="196" y="288" width="208" height="16" rx="8"/>`, P.clay)
      );
    },
  },
};

function main() {
  const out = join(process.cwd(), "public", "products");
  mkdirSync(out, { recursive: true });
  for (const [slug, ill] of Object.entries(ILLUSTRATIONS)) {
    clipId = 0;
    idPrefix = slug.split("-")[0];
    const svg = frame(ill.category, ill.draw(), ill.shadow);
    writeFileSync(join(out, `${slug}.svg`), svg + "\n", "utf8");
  }
  console.log(`Wrote ${Object.keys(ILLUSTRATIONS).length} illustrations to ${out}`);
}

main();
