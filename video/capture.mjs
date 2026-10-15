// Films the LIVE deployment at 1920x1080: stills of real screens (and of a real jury round and a real execution),
// plus a caption overlay PNG per shot. Nothing is mocked. The only transactions sent are the ones the film shows:
// one jury round and one execution on a proposal made for this purpose (see prepare.mjs).
//   node --experimental-strip-types capture.mjs            # all shots
//   node --experimental-strip-types capture.mjs hero how   # just these
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import puppeteer from "puppeteer-core";
import { shots } from "./storyboard.mjs";
import { fingerprintUrl } from "../web/src/lib/fingerprint.ts";
import { clientFor, view } from "../web/scripts/chain-lib.mjs";

const EDGE = process.env.EDGE_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const SITE = process.env.SITE ?? "https://mandate-virid.vercel.app";
const CONTRACT = "0x91bCDA69Bedb0a5F15E88e37a36CAcEC92a09646";
const live = JSON.parse(readFileSync("live.json", "utf8"));
const only = new Set(process.argv.slice(2));
mkdirSync("frames", { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, protocolTimeout: 600000, args: ["--no-first-run", "--hide-scrollbars", "--force-device-scale-factor=1"] });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

// innerText honours CSS text-transform (uppercase headings), so every match is case-insensitive
const text = () => page.evaluate(() => document.body.innerText.toLowerCase());
async function waitText(needle, timeout = 150000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if ((await text()).includes(needle.toLowerCase())) return true;
    await sleep(1500);
  }
  throw new Error(`timed out waiting for "${needle}"`);
}
async function go(hash, needle) {
  await page.goto(`${SITE}/#${hash}`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => location.reload());
  await page.waitForFunction("document.readyState === 'complete'", { timeout: 60000 }).catch(() => {});
  if (needle) await waitText(needle);
  await sleep(1200);
}
async function clickByText(selector, needle) {
  const ok = await page.evaluate(
    (sel, n) => {
      const el = [...document.querySelectorAll(sel)].find((e) => e.textContent.includes(n));
      if (!el) return false;
      el.click();
      return true;
    },
    selector,
    needle,
  );
  if (!ok) throw new Error(`no ${selector} containing "${needle}"`);
}
async function scrollToText(selector, needle, offset = 100) {
  await page.evaluate(
    (sel, n, off) => {
      const el = [...document.querySelectorAll(sel)].find((e) => e.textContent.includes(n));
      if (el) {
        el.scrollIntoView({ block: "start", behavior: "instant" });
        window.scrollBy({ top: -off, behavior: "instant" });
      }
    },
    selector,
    needle,
    offset,
  );
  await sleep(700);
}
const scrollTop = async () => (await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" })), sleep(500));

async function capCard(shot) {
  if (!shot.caption && shot.id !== "endcard") return;
  const p = await browser.newPage();
  await p.setViewport({ width: 1920, height: 1080 });
  const step = shot.step ? `<div class="step">${shot.step}</div>` : "";
  await p.setContent(`<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;background:transparent;width:1920px;height:1080px;font-family:Inter,"Segoe UI",Arial,sans-serif;color:#f4f4f7}
    .wrap{position:absolute;left:0;right:0;bottom:64px;display:flex;justify-content:center}
    .box{max-width:1380px;padding:22px 34px 24px;border-radius:20px;background:rgba(6,7,12,.86);border:1px solid rgba(196,199,224,.28);box-shadow:0 24px 70px rgba(0,0,0,.55)}
    .step{font:600 19px Inter,"Segoe UI",Arial;letter-spacing:.16em;text-transform:uppercase;color:#ffc08a;margin-bottom:8px}
    .cap{font:500 35px/1.34 Inter,"Segoe UI",Arial;letter-spacing:-.01em}
  </style><div class="wrap"><div class="box">${step}<div class="cap">${shot.caption}</div></div></div>`);
  await p.screenshot({ path: `frames/${shot.id}.cap.png`, omitBackground: true });
  await p.close();
}
async function snap(id) {
  await page.screenshot({ path: `frames/${id}.png` });
  log("shot", id);
}
const want = (id) => only.size === 0 || only.has(id);

// ------------------------------------------------------------------------------------------------ 1: home + builder
if (["hero", "builder-limit", "builder-details", "builder-confirm"].some(want)) {
  await go("/", "Policy builder");
  await waitText("Green Transition Treasury");
  if (want("hero")) await snap("hero");
  if (want("builder-limit")) {
    await clickByText(".pcard", "Spending limits");
    await sleep(1800);
    await snap("builder-limit");
  }
  if (want("builder-details")) {
    await clickByText(".pcard", "Time constraints");
    await sleep(1400);
    await page.evaluate(() => {
      document.getElementById("policy-builder").scrollIntoView({ block: "start", behavior: "instant" });
      window.scrollBy({ top: -80, behavior: "instant" });
    });
    await sleep(900);
    await snap("builder-details");
  }
  if (want("builder-confirm")) {
    if (!(await text()).includes("hide details")) await clickByText(".pcard", "Time constraints");
    await sleep(800);
    await clickByText("button", "Save policy");
    await sleep(1200);
    await snap("builder-confirm");
    await clickByText("dialog button", "Cancel");
  }
}

// ------------------------------------------------------------------------------------------------ 2: the fund
if (want("fund-charter") || want("fund-treasury")) {
  await go("/f/1", "Frozen mandate");
  await waitText("utility-scale solar");
  if (want("fund-charter")) {
    await scrollTop();
    await snap("fund-charter");
  }
  if (want("fund-treasury")) {
    await scrollToText("h2", "Treasury", 90);
    await snap("fund-treasury");
  }
}

// ------------------------------------------------------------------------------------------------ 3: propose
if (want("propose-form")) {
  await go("/f/1/propose", "Propose an allocation");
  const fp = await fingerprintUrl(live.url);
  await page.type("#target", live.target, { delay: 28 });
  await page.type("#amount", live.amount, { delay: 40 });
  const existing = await view(clientFor(), CONTRACT, "get_proposal", [BigInt(live.proposalId)]);
  await page.type("#payee", existing.payee, { delay: 4 }); // a name can only ever pay one address, so reuse the target's own
  await page.type("#thesis", live.thesis, { delay: 12 });
  await page.type("#u0", live.url, { delay: 8 });
  await page.type("#h0", fp.hash, { delay: 0 });
  await sleep(700);
  await snap("propose-form");
}
if (want("proposal-pending")) {
  await go(`/p/${live.proposalId}`, "Awaiting jury");
  await scrollTop();
  await snap("proposal-pending");
}

// ------------------------------------------------------------------------------------------------ 4: a REAL jury round
if (["jury-running", "jury-done", "jury-evidence", "refusal", "appeal", "execute-running", "executed"].some(want) && (want("jury-running") || want("jury-done") || want("jury-evidence"))) {
  await go(`/p/${live.proposalId}`, "Awaiting jury");
  await page.click(".acct-btn");
  await sleep(500);
  await clickByText(".acct-menu button", "Use demo account");
  await sleep(800);
  await clickByText("button", "Ask the jury");
  log("jury round sent");
  await sleep(9000);
  await scrollToText("h2", "Actions", 120);
  await snap("jury-running");
  await waitText("Approved, in appeal window", 420000);
  log("approved on-chain");
  await waitText("validators agreed with the leader", 150000).catch(() => log("no vote line yet; continuing"));
  await scrollTop();
  await sleep(1500);
  await snap("jury-done");
  await scrollToText("h2", "Evidence the jury read", 140);
  await snap("jury-evidence");
}

// ------------------------------------------------------------------------------------------------ 5: refusal, appeal
if (want("refusal")) {
  await go("/p/3", "Because");
  await scrollTop();
  await snap("refusal");
}
if (want("appeal")) {
  await go("/p/2", "Appeal");
  await scrollToText("h2", "Appeal", 90);
  await snap("appeal");
}

// ------------------------------------------------------------------------------------------------ 6: a REAL execution with last look
if (want("execute-running") || want("executed")) {
  await go(`/p/${live.proposalId}`, "Approved");
  // the 3-minute appeal window must pass; reload until the Execute button is offered
  const t0 = Date.now();
  while (!(await text()).includes("execute (re-reads the evidence first)")) {
    if (Date.now() - t0 > 420000) throw new Error("execute button never appeared");
    await sleep(20000);
    await page.evaluate(() => location.reload());
    await sleep(9000);
  }
  await clickByText("button", "Execute (re-reads");
  log("execute sent");
  await sleep(9000);
  await scrollToText("h2", "Actions", 120);
  await snap("execute-running");
  // the stepper always says "Executed", so wait for the row that only exists once the last look has run
  await waitText("Last look at execution", 420000);
  await sleep(2500);
  await scrollTop();
  await sleep(800);
  await snap("executed");
}

// ------------------------------------------------------------------------------------------------ 7: watchdog, how
if (want("watchdog")) {
  await go("/f/2", "Standing watch");
  await waitText("deepwater horizon");
  await scrollToText("h2", "Positions", 90);
  await snap("watchdog");
}
if (want("how")) {
  await go("/how", "The exact instructions");
  await waitText("MANDATE_JUDGE").catch(() => {});
  await scrollToText("h2", "The exact instructions", 90);
  await snap("how");
}

// ------------------------------------------------------------------------------------------------ end card + captions
if (want("endcard")) {
  const p = await browser.newPage();
  await p.setViewport({ width: 1920, height: 1080 });
  await p.setContent(`<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;width:1920px;height:1080px;background:radial-gradient(900px 520px at 70% 40%,rgba(255,140,120,.28),transparent 70%),radial-gradient(700px 420px at 20% 10%,rgba(213,108,255,.14),transparent 70%),#050609;color:#f4f4f7;font-family:Inter,"Segoe UI",Arial,sans-serif}
    .c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
    .m{display:flex;align-items:center;gap:22px;font:600 54px Inter,"Segoe UI",Arial;letter-spacing:.3em}
    h1{font:600 58px/1.15 Inter,"Segoe UI",Arial;letter-spacing:-.02em;margin:46px 0 14px}
    p{font:400 28px/1.5 Inter,"Segoe UI",Arial;color:#b9bbc8;margin:6px 0}
    code{font:500 24px Consolas,monospace;color:#ffc08a}
    .pill{margin-top:34px;display:inline-block;padding:10px 24px;border:1px solid rgba(196,199,224,.3);border-radius:999px;font:500 22px Inter,"Segoe UI",Arial;color:#b9bbc8}
  </style><div class="c"><div class="m"><svg width="64" height="64" viewBox="0 0 32 32" fill="none"><path d="M16 3 29 27H3L16 3Z" stroke="#f4f4f7" stroke-width="2.2" stroke-linejoin="round"/><path d="M16 13.5 21.2 23H10.8L16 13.5Z" fill="#ffb879"/></svg>MANDATE</div>
  <h1>Bounded authority.<br/>Decided by validators. Enforced by code.</h1>
  <p>mandate-virid.vercel.app</p><p>github.com/s70239176-ctrl/mandate</p><p><code>${CONTRACT}</code></p>
  <div class="pill">Live on GenLayer Studionet (a test network, demo account)</div></div>`);
  await p.screenshot({ path: "frames/endcard.png" });
  await p.close();
  log("shot endcard");
}
for (const s of shots) if (want(s.id)) await capCard(s);
await browser.close();
writeFileSync("frames/.done", new Date().toISOString());
log("done");
