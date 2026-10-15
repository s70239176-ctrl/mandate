// Generates the cinematic hero artwork: a dark rocky landscape with a tall glowing rectangular portal, warm light
// spilling over jagged rock and a glossy ground that reflects it. Fully procedural and deterministic (seeded), so the
// asset is reproducible and licence-free. Output: public/hero.webp (+ hero-mobile.webp), rasterised from SVG.
//   node scripts/make-hero.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const pub = join(here, "..", "public");
mkdirSync(pub, { recursive: true });

const W = 2400;
const H = 1100;
const PX = 1430; // portal centre x
const PY = 740; // portal base y
const PW = 150;
const PH = 560;

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Midpoint-displacement ridge line from x0 to x1 around baseY. */
function ridge(x0, x1, baseY, amp, rough, seed, steps = 7) {
  const r = rng(seed);
  let pts = [
    [x0, baseY + (r() - 0.5) * amp],
    [x1, baseY + (r() - 0.5) * amp],
  ];
  let a = amp;
  for (let i = 0; i < steps; i++) {
    const next = [];
    for (let j = 0; j < pts.length - 1; j++) {
      const [xa, ya] = pts[j];
      const [xb, yb] = pts[j + 1];
      next.push(pts[j]);
      next.push([(xa + xb) / 2, (ya + yb) / 2 + (r() - 0.5) * a]);
    }
    next.push(pts[pts.length - 1]);
    pts = next;
    a *= rough;
  }
  return pts;
}

const path = (pts, bottom) => `M${pts[0][0].toFixed(1)},${bottom} ` + pts.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(" ") + ` L${pts[pts.length - 1][0].toFixed(1)},${bottom} Z`;
const line = (pts) => "M" + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L");

/** A tall angular spire: a column of jagged facets. */
function spire(cx, baseY, w, h, seed, lean = 0) {
  const r = rng(seed);
  const n = 9;
  const left = [];
  const right = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const y = baseY - h * t;
    const taper = 1 - t * 0.78;
    const jag = (r() - 0.5) * w * 0.34;
    left.push([cx - (w / 2) * taper + jag + lean * t * h, y]);
    right.push([cx + (w / 2) * taper + (r() - 0.5) * w * 0.34 + lean * t * h, y]);
  }
  const top = [cx + lean * h + (r() - 0.5) * w * 0.1, baseY - h - h * 0.06];
  const pts = [...left, top, ...right.reverse()];
  return { d: "M" + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L") + " Z", left, right };
}

const defs = `
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#04050a"/>
    <stop offset="0.38" stop-color="#0d0a1c"/>
    <stop offset="0.62" stop-color="#2a1236"/>
    <stop offset="0.74" stop-color="#5a2540"/>
    <stop offset="1" stop-color="#1a0d22"/>
  </linearGradient>
  <radialGradient id="aura" cx="${PX}" cy="${PY - PH * 0.5}" r="900" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#fff2d8" stop-opacity="0.95"/>
    <stop offset="0.08" stop-color="#ffc58a" stop-opacity="0.75"/>
    <stop offset="0.22" stop-color="#ff8a7a" stop-opacity="0.42"/>
    <stop offset="0.45" stop-color="#c25ad6" stop-opacity="0.2"/>
    <stop offset="0.75" stop-color="#5b3aa8" stop-opacity="0.08"/>
    <stop offset="1" stop-color="#2a1a5a" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="crown" cx="${PX}" cy="${PY - PH - 40}" r="520" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#fff6e4" stop-opacity="0.95"/>
    <stop offset="0.18" stop-color="#ffd7a6" stop-opacity="0.6"/>
    <stop offset="0.5" stop-color="#ff9b8a" stop-opacity="0.18"/>
    <stop offset="1" stop-color="#ff9b8a" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="portalFace" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffffff"/>
    <stop offset="0.15" stop-color="#fff0d6"/>
    <stop offset="0.55" stop-color="#ffc98f"/>
    <stop offset="0.85" stop-color="#ff9a86"/>
    <stop offset="1" stop-color="#ff7a9a"/>
  </linearGradient>
  <linearGradient id="portalEdge" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#ff6f8a"/>
    <stop offset="0.5" stop-color="#fff0d8"/>
    <stop offset="1" stop-color="#ff5fb0"/>
  </linearGradient>
  <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#2a1330"/>
    <stop offset="0.25" stop-color="#150b1e"/>
    <stop offset="1" stop-color="#05040a"/>
  </linearGradient>
  <linearGradient id="far" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#4a2a58"/>
    <stop offset="1" stop-color="#1c1030"/>
  </linearGradient>
  <linearGradient id="mid" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#2a1738"/>
    <stop offset="1" stop-color="#0e0818"/>
  </linearGradient>
  <linearGradient id="rockL" x1="1" y1="0" x2="0" y2="0">
    <stop offset="0" stop-color="#3a1f3c"/>
    <stop offset="0.35" stop-color="#120a1a"/>
    <stop offset="1" stop-color="#06050a"/>
  </linearGradient>
  <linearGradient id="rockR" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#3a1f3c"/>
    <stop offset="0.35" stop-color="#120a1a"/>
    <stop offset="1" stop-color="#06050a"/>
  </linearGradient>
  <linearGradient id="refl" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffd9a8" stop-opacity="0.85"/>
    <stop offset="0.3" stop-color="#ff8f9c" stop-opacity="0.45"/>
    <stop offset="0.7" stop-color="#b24ed0" stop-opacity="0.2"/>
    <stop offset="1" stop-color="#5b3aa8" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="vig" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#000" stop-opacity="0.55"/>
    <stop offset="0.28" stop-color="#000" stop-opacity="0"/>
    <stop offset="0.8" stop-color="#000" stop-opacity="0"/>
    <stop offset="1" stop-color="#000" stop-opacity="0.45"/>
  </linearGradient>
  <filter id="b4" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4"/></filter>
  <filter id="b14" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
  <filter id="b40" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="40"/></filter>
  <filter id="b90" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="90"/></filter>
  <filter id="haze" x="0" y="0" width="100%" height="100%"><feGaussianBlur stdDeviation="22"/></filter>
  <filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.09 0"/>
  </filter>
  <filter id="rock" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.012 0.03" numOctaves="4" seed="11" result="t"/>
    <feColorMatrix in="t" type="matrix" values="0 0 0 0 0.9  0 0 0 0 0.5  0 0 0 0 0.7  0 0 0 0.35 -0.08"/>
    <feComposite in2="SourceGraphic" operator="in"/>
  </filter>
  <clipPath id="skyclip"><rect width="${W}" height="${PY}"/></clipPath>
  <clipPath id="groundclip"><rect y="${PY}" width="${W}" height="${H - PY}"/></clipPath>
</defs>`;

const parts = [];
parts.push(`<rect width="${W}" height="${H}" fill="url(#sky)"/>`);

// stars
{
  const r = rng(99);
  let s = "";
  for (let i = 0; i < 160; i++) {
    const x = r() * W;
    const y = r() * (PY * 0.55);
    const o = 0.15 + r() * 0.55;
    s += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(0.5 + r() * 1.1).toFixed(2)}" fill="#fff" opacity="${o.toFixed(2)}"/>`;
  }
  parts.push(`<g>${s}</g>`);
}

// the aura behind everything
parts.push(`<rect width="${W}" height="${H}" fill="url(#aura)"/>`);
parts.push(`<ellipse cx="${PX}" cy="${PY - PH * 0.45}" rx="330" ry="420" fill="#ff9a7a" opacity="0.28" filter="url(#b90)"/>`);

// distant range (lit from the portal)
const far = ridge(-100, W + 100, PY - 250, 430, 0.62, 3, 8);
parts.push(`<path d="${path(far, PY + 20)}" fill="url(#far)" opacity="0.95"/>`);
parts.push(`<path d="${line(far)}" fill="none" stroke="#ff9f93" stroke-opacity="0.16" stroke-width="2"/>`);
// haze bands
parts.push(`<rect y="${PY - 220}" width="${W}" height="190" fill="#e9789a" opacity="0.16" filter="url(#haze)"/>`);

// mid ridge
const mid = ridge(-100, W + 100, PY - 120, 330, 0.6, 8, 8);
parts.push(`<path d="${path(mid, PY + 30)}" fill="url(#mid)"/>`);
parts.push(`<path d="${line(mid)}" fill="none" stroke="#ffb28a" stroke-opacity="0.22" stroke-width="2.2"/>`);

// mid spires around the portal (frame it, never cover it)
const spires = [
  [820, PY - 20, 190, 500, 21, 0.04],
  [1010, PY - 10, 150, 390, 22, -0.02],
  [1790, PY - 10, 170, 430, 23, 0.03],
  [1950, PY - 20, 210, 560, 24, -0.05],
];
for (const [cx, by, w, h, seed, lean] of spires) {
  const sp = spire(cx, by, w, h, seed, lean);
  parts.push(`<path d="${sp.d}" fill="#0b0612"/>`);
  const nearPortal = cx < PX ? sp.right : sp.left;
  parts.push(`<path d="${line(nearPortal)}" fill="none" stroke="#ffb184" stroke-opacity="0.55" stroke-width="2.4" filter="url(#b4)"/>`);
  parts.push(`<path d="${line(nearPortal)}" fill="none" stroke="#ffe0c0" stroke-opacity="0.35" stroke-width="1.2"/>`);
}

// the portal
const px0 = PX - PW / 2;
const py0 = PY - PH;
parts.push(`<rect x="${px0 - 60}" y="${py0 - 60}" width="${PW + 120}" height="${PH + 120}" fill="#ff8f7a" opacity="0.55" filter="url(#b40)"/>`);
parts.push(`<rect x="${px0 - 16}" y="${py0 - 16}" width="${PW + 32}" height="${PH + 32}" rx="6" fill="#ffd9ad" opacity="0.7" filter="url(#b14)"/>`);
parts.push(`<rect x="${px0}" y="${py0}" width="${PW}" height="${PH}" fill="url(#portalFace)"/>`);
parts.push(`<rect x="${px0 + 26}" y="${py0 + 20}" width="${PW - 52}" height="${PH - 40}" fill="#fffaf0" opacity="0.65" filter="url(#b14)"/>`);
parts.push(`<rect x="${px0}" y="${py0}" width="${PW}" height="${PH}" fill="none" stroke="url(#portalEdge)" stroke-width="5"/>`);
parts.push(`<rect x="${px0 - 4}" y="${py0 - 4}" width="${PW + 8}" height="${PH + 8}" fill="none" stroke="#ff6fb0" stroke-opacity="0.55" stroke-width="3" filter="url(#b4)"/>`);
parts.push(`<rect width="${W}" height="${H}" fill="url(#crown)"/>`);

// foreground massifs: tall ragged rock masses that frame the portal, rim-lit on the side that faces it
function massif(side, seed) {
  const r = rng(seed);
  const pts = [];
  const reach = side === "L" ? 980 : 880; // how far toward the portal they extend
  const steps = 46;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps; // 0 at the screen edge -> 1 toward the portal
    const x = side === "L" ? t * reach : W - t * reach;
    const base = 40 + Math.pow(t, 1.6) * (PY - 60);
    const jag = (r() - 0.5) * (150 - t * 70) + (r() > 0.82 ? -(60 + r() * 140) * (1 - t) : 0);
    pts.push([x, Math.max(-30, base + jag - 120 * Math.sin(t * Math.PI * 0.9))]);
  }
  const edge = side === "L" ? -60 : W + 60;
  const all = [[edge, -60], ...pts, [pts[pts.length - 1][0] + (side === "L" ? 30 : -30), H + 40], [edge, H + 40]];
  return { all, rim: pts };
}
for (const [side, seed, grad] of [["L", 41, "rockL"], ["R", 57, "rockR"]]) {
  const m = massif(side, seed);
  parts.push(`<path d="M${m.all.map(([x, y]) => `${x.toFixed(0)},${y.toFixed(0)}`).join(" L")} Z" fill="url(#${grad})"/>`);
  parts.push(`<path d="M${m.rim.map(([x, y]) => `${x.toFixed(0)},${y.toFixed(0)}`).join(" L")}" fill="none" stroke="${side === "L" ? "#ff9a8a" : "#ff8fb6"}" stroke-opacity="0.5" stroke-width="3.4" filter="url(#b4)"/>`);
  parts.push(`<path d="M${m.rim.map(([x, y]) => `${x.toFixed(0)},${y.toFixed(0)}`).join(" L")}" fill="none" stroke="#ffe3c8" stroke-opacity="0.3" stroke-width="1.3"/>`);
  // faceted shading: darker angular planes inside the mass
  const r = rng(seed + 5);
  for (let i = 0; i < 14; i++) {
    const a = m.rim[Math.floor(r() * (m.rim.length - 4))];
    const x1 = a[0] + (side === "L" ? -r() * 380 : r() * 380);
    const y1 = a[1] + 60 + r() * 360;
    parts.push(`<path d="M${a[0].toFixed(0)},${a[1].toFixed(0)} L${x1.toFixed(0)},${y1.toFixed(0)} L${(x1 + (r() - 0.5) * 160).toFixed(0)},${(y1 + 140 + r() * 180).toFixed(0)} Z" fill="#000" opacity="${(0.18 + r() * 0.22).toFixed(2)}"/>`);
  }
}

// ground plane
const groundTop = ridge(-100, W + 100, PY + 6, 26, 0.55, 55, 6);
parts.push(`<path d="${path(groundTop, H + 10)}" fill="url(#ground)"/>`);

// reflection of the portal on the glossy ground
parts.push(`<g clip-path="url(#groundclip)">`);
parts.push(`<rect x="${px0 - 30}" y="${PY}" width="${PW + 60}" height="330" fill="url(#refl)" opacity="0.9" filter="url(#b14)"/>`);
parts.push(`<rect x="${px0}" y="${PY}" width="${PW}" height="260" fill="url(#refl)" opacity="0.95"/>`);
{
  const r = rng(63);
  for (let i = 0; i < 34; i++) {
    const x = px0 - 520 + r() * (PW + 1040);
    const y = PY + 14 + r() * 300;
    const w = 40 + r() * 280;
    const o = 0.05 + r() * 0.16 * (1 - Math.abs(x - PX) / 700);
    parts.push(`<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="${(2 + r() * 4).toFixed(1)}" fill="${r() > 0.5 ? "#ff9ac0" : "#ffcf9e"}" opacity="${Math.max(0, o).toFixed(2)}" filter="url(#b4)"/>`);
  }
}
parts.push(`<ellipse cx="${PX}" cy="${PY + 40}" rx="760" ry="120" fill="#d56cff" opacity="0.26" filter="url(#b40)"/>`);
parts.push(`</g>`);

// foreground boulders and cracks for depth
{
  const r = rng(71);
  for (let i = 0; i < 46; i++) {
    const x = r() * W;
    if (Math.abs(x - PX) < 170 && r() > 0.25) continue;
    const y = PY + 90 + r() * 260;
    const w = 70 + r() * 260;
    const h = 30 + r() * 120;
    const pts = [[x - w / 2, y + h], [x - w * 0.3, y + h * 0.2], [x + w * 0.05, y - h * 0.4], [x + w * 0.38, y + h * 0.1], [x + w / 2, y + h]];
    parts.push(`<path d="M${pts.map(([a, b]) => `${a.toFixed(0)},${b.toFixed(0)}`).join(" L")} Z" fill="#05040a"/>`);
    parts.push(`<path d="M${pts[1][0].toFixed(0)},${pts[1][1].toFixed(0)} L${pts[2][0].toFixed(0)},${pts[2][1].toFixed(0)} L${pts[3][0].toFixed(0)},${pts[3][1].toFixed(0)}" fill="none" stroke="#ff9d8e" stroke-opacity="${(0.12 + r() * 0.16).toFixed(2)}" stroke-width="2"/>`);
  }
}

// atmosphere: low haze, vignette, grain
parts.push(`<rect y="${PY - 70}" width="${W}" height="150" fill="#ff8aa6" opacity="0.1" filter="url(#haze)"/>`);
parts.push(`<rect width="${W}" height="${H}" fill="url(#vig)"/>`);
parts.push(`<rect y="${H - 260}" width="${W}" height="260" fill="#000" opacity="0.5" filter="url(#b90)"/>`);
parts.push(`<rect width="${W}" height="${H}" filter="url(#grain)"/>`);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${defs}${parts.join("\n")}</svg>`;
writeFileSync(join(pub, "hero.svg"), svg);

await sharp(Buffer.from(svg)).webp({ quality: 80 }).toFile(join(pub, "hero.webp"));
// A tighter crop (portal-centred) for narrow screens.
await sharp(Buffer.from(svg)).extract({ left: 900, top: 120, width: 1000, height: 980 }).resize(900).webp({ quality: 78 }).toFile(join(pub, "hero-mobile.webp"));
await sharp(Buffer.from(svg)).resize(1200).png().toFile(join(here, "..", "hero-preview.png"));
console.log("wrote public/hero.webp, public/hero-mobile.webp, hero-preview.png");
