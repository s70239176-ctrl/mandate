// Assemble the film: a slow camera move on each captured screen, a caption overlay that fades in and out, crossfades
// between shots, the original soundtrack mixed under it, and a sidecar .srt of the captions.
//   node build.mjs   ->  out/mandate-demo.mp4  (+ out/mandate-demo.srt)
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { shots, XF } from "./storyboard.mjs";

const FFMPEG =
  process.env.FFMPEG ??
  "C:/Users/User/AppData/Roaming/Python/Python314/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe";
const FPS = 30;
mkdirSync("clips", { recursive: true });
mkdirSync("out", { recursive: true });

function run(args, label) {
  const r = spawnSync(FFMPEG, ["-y", "-loglevel", "error", ...args], { encoding: "utf8", maxBuffer: 1 << 28 });
  if (r.status !== 0) {
    console.error(`ffmpeg failed (${label}):\n${r.stderr}`);
    process.exit(1);
  }
}

// a gentle, different drift per shot so the film never feels like a slideshow
const MOVES = [
  { z0: 1.0, z1: 1.07, fx: 0.5, fy: 0.5, tx: 0.54, ty: 0.46 },
  { z0: 1.07, z1: 1.0, fx: 0.55, fy: 0.5, tx: 0.5, ty: 0.5 },
  { z0: 1.0, z1: 1.06, fx: 0.46, fy: 0.55, tx: 0.5, ty: 0.5 },
  { z0: 1.06, z1: 1.0, fx: 0.5, fy: 0.45, tx: 0.5, ty: 0.52 },
];

const missing = shots.filter((s) => !existsSync(`frames/${s.id}.png`));
if (missing.length) {
  console.error("missing frames:", missing.map((s) => s.id).join(", "));
  process.exit(1);
}

let t = 0;
const timeline = shots.map((s, i) => {
  const D = s.seconds + XF; // each clip overlaps the next by XF
  const c = { ...s, D, start: t, i };
  t += s.seconds;
  return c;
});
const total = t + XF;
console.log(`${timeline.length} shots, ${total.toFixed(1)} s`);

for (const c of timeline) {
  const N = Math.round(c.D * FPS);
  const m = MOVES[c.i % MOVES.length];
  const out = `clips/${c.id}-${Math.round(c.D * 1000)}.mp4`;
  c.file = out;
  const hasCap = existsSync(`frames/${c.id}.cap.png`) && c.caption;
  const zoom = `${m.z0}+(${m.z1}-${m.z0})*on/${N}`;
  const x = `(iw-iw/zoom)*(${m.fx}+(${m.tx}-${m.fx})*on/${N})`;
  const y = `(ih-ih/zoom)*(${m.fy}+(${m.ty}-${m.fy})*on/${N})`;
  const base = `[0:v]scale=3840:2160:flags=lanczos,zoompan=z='${zoom}':x='${x}':y='${y}':d=${N}:s=1920x1080:fps=${FPS},format=yuv420p[v]`;
  const capIn = hasCap ? ["-loop", "1", "-t", String(c.D), "-i", `frames/${c.id}.cap.png`] : [];
  const graph = hasCap
    ? `${base};[1:v]format=rgba,fade=t=in:st=0.55:d=0.5:alpha=1,fade=t=out:st=${(c.D - XF - 0.6).toFixed(2)}:d=0.5:alpha=1[cap];[v][cap]overlay=0:0:format=auto,format=yuv420p[o]`
    : `${base};[v]null[o]`;
  console.log("  clip", c.id, `${c.D.toFixed(2)}s`);
  run(["-i", `frames/${c.id}.png`, ...capIn, "-filter_complex", graph, "-map", "[o]", "-t", String(c.D), "-r", String(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", out], c.id);
}

// ---- crossfade chain + audio
const inputs = timeline.flatMap((c) => ["-i", c.file]);
let graph = "";
let last = "[0:v]";
let acc = timeline[0].D;
for (let k = 1; k < timeline.length; k++) {
  const off = (acc - XF).toFixed(3);
  graph += `${last}[${k}:v]xfade=transition=fade:duration=${XF}:offset=${off}[x${k}];`;
  last = `[x${k}]`;
  acc += timeline[k].D - XF;
}
graph += `${last}fade=t=in:st=0:d=0.8,fade=t=out:st=${(total - 1.4).toFixed(2)}:d=1.4[vout]`;
const audioIdx = timeline.length;
const afilter = `[${audioIdx}:a]atrim=0:${total.toFixed(2)},afade=t=in:st=0:d=1.6,afade=t=out:st=${(total - 4).toFixed(2)}:d=4,loudnorm=I=-19:TP=-2:LRA=9[aout]`;

console.log("encoding final…");
run(
  [...inputs, "-i", "audio/soundtrack.wav", "-filter_complex", `${graph};${afilter}`, "-map", "[vout]", "-map", "[aout]", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-t", total.toFixed(2), "out/mandate-demo.mp4"],
  "final",
);

// ---- sidecar captions
const ts = (s) => {
  const ms = Math.round(s * 1000);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor((ms / 60000) % 60))}:${p(Math.floor((ms / 1000) % 60))},${p(ms % 1000, 3)}`;
};
let srt = "";
let n = 1;
for (const c of timeline) {
  if (!c.caption) continue;
  const text = (c.step ? `${c.step}\n` : "") + c.caption;
  srt += `${n++}\n${ts(c.start + 0.55)} --> ${ts(c.start + c.seconds - 0.15)}\n${text}\n\n`;
}
writeFileSync("out/mandate-demo.srt", srt);
console.log("wrote out/mandate-demo.mp4 and out/mandate-demo.srt");
