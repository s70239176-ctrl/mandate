// Exports the Mandate brand files into docs/brand/: the mark (two nested triangles: a boundary, and what it
// contains), an app icon, and a horizontal lockup with the wordmark. SVG masters plus PNG renders, for dark and
// light backgrounds.   node scripts/make-logo.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "docs", "brand");
mkdirSync(out, { recursive: true });

const DARK = { line: "#f4f4f7", core: ["#7a66ff", "#d56cff"], text: "#f4f4f7", bg: "#050609" };
const LIGHT = { line: "#14122b", core: ["#5642d6", "#bf4fe6"], text: "#14122b", bg: "#ffffff" };

// The mark, drawn in a 32x32 box.
// The core is an indigo-to-magenta gradient (Mandate's own colours, from the portal and the primary action).
const mark = (c, extra = "") =>
  `<g ${extra}><defs><linearGradient id="core" x1="8" y1="24" x2="24" y2="12" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${c.core[0]}"/><stop offset="1" stop-color="${c.core[1]}"/></linearGradient></defs><path d="M16 3 29 27H3L16 3Z" fill="none" stroke="${c.line}" stroke-width="2.2" stroke-linejoin="round"/><path d="M16 13.5 21.2 23H10.8L16 13.5Z" fill="url(#core)"/></g>`;

const markSvg = (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="512" height="512" role="img" aria-label="Mandate">${mark(c)}</svg>\n`;

// App icon: the mark on a rounded square (the favicon).
const iconSvg = (c, bg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="512" height="512" role="img" aria-label="Mandate"><rect width="64" height="64" rx="14" fill="${bg}"/>${mark(c, 'transform="translate(10 10) scale(1.5)"')}</svg>\n`;

// Lockup: mark plus MANDATE in widely tracked bold capitals. Text uses a common system sans stack; the PNG renders
// are the authoritative artwork when exact lettering matters.
const lockupSvg = (c, withBg) => {
  const W = 1200;
  const H = 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Mandate">${withBg ? `<rect width="${W}" height="${H}" fill="${withBg}"/>` : ""}${mark(c, 'transform="translate(90 90) scale(5.625)"')}<text x="320" y="228" font-family="Inter, 'Segoe UI', Arial, Helvetica, sans-serif" font-weight="700" font-size="112" letter-spacing="30" fill="${c.text}">MANDATE</text></svg>\n`;
};

const files = {
  "mark-on-dark.svg": markSvg(DARK),
  "mark-on-light.svg": markSvg(LIGHT),
  "app-icon.svg": iconSvg(DARK, DARK.bg),
  "lockup-on-dark.svg": lockupSvg(DARK),
  "lockup-on-light.svg": lockupSvg(LIGHT),
};
for (const [name, svg] of Object.entries(files)) writeFileSync(join(out, name), svg);

const png = async (svg, name, width, bg) => {
  let img = sharp(Buffer.from(svg), { density: 384 }).resize(width);
  if (bg) img = img.flatten({ background: bg });
  await img.png().toFile(join(out, name));
};
await png(files["mark-on-dark.svg"], "mark-on-dark.png", 1024);
await png(files["mark-on-light.svg"], "mark-on-light.png", 1024);
await png(files["app-icon.svg"], "app-icon-512.png", 512);
await png(files["lockup-on-dark.svg"], "lockup-on-dark.png", 2400);
await png(files["lockup-on-light.svg"], "lockup-on-light.png", 2400);
// ready-to-use versions with a solid background
await png(lockupSvg(DARK, DARK.bg), "lockup-dark-background.png", 2400);
await png(lockupSvg(LIGHT, LIGHT.bg), "lockup-light-background.png", 2400);
console.log("wrote", Object.keys(files).length, "svg and 7 png files to docs/brand/");
