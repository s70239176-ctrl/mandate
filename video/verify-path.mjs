// Walks the reviewer path from docs/SUBMISSION-FORM.md on the LIVE site, in a fresh browser profile, exactly as a
// reviewer would: demo account -> save a policy (creates a fund) -> propose with a public evidence page -> ask the
// jury. Prints what it saw at every step and saves screenshots to check/.
//   node verify-path.mjs
import { mkdirSync } from "node:fs";
import puppeteer from "puppeteer-core";

const EDGE = process.env.EDGE_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const SITE = process.env.SITE ?? "https://mandate-virid.vercel.app";
const EVIDENCE = "https://raw.githubusercontent.com/s70239176-ctrl/mandate/main/fixtures/evidence/sunrow-solar.md";
mkdirSync("check", { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, protocolTimeout: 600000, args: ["--no-first-run", "--hide-scrollbars"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000 });
const text = () => page.evaluate(() => document.body.innerText.toLowerCase());
async function waitText(needle, timeout = 240000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if ((await text()).includes(needle.toLowerCase())) return;
    await sleep(1500);
  }
  await page.screenshot({ path: `check/verify-timeout.png` });
  throw new Error(`timed out waiting for "${needle}"`);
}
async function click(selector, needle) {
  const ok = await page.evaluate((s, n) => {
    const el = [...document.querySelectorAll(s)].find((e) => e.textContent.includes(n));
    if (!el) return false;
    el.click();
    return true;
  }, selector, needle);
  if (!ok) throw new Error(`no ${selector} containing "${needle}"`);
}
const shot = (n) => page.screenshot({ path: `check/verify-${n}.png` });

// 1. open + demo account
await page.goto(`${SITE}/#/`, { waitUntil: "domcontentloaded" });
await waitText("policy builder");
await page.click(".acct-btn");
await click(".acct-menu button", "Use demo account");
await waitText("demo account");
log("1 demo account ready");

// 2. save the policy (creates a fund)
await click("button", "Save policy");
await waitText("freeze this policy");
await click("dialog button", "Create fund");
log("2 create_fund sent; waiting for it to finalize");
await waitText("fund created on-chain", 360000);
await shot("fund-created");
log("2 fund created");

// 3. open the newest fund (the list is newest first and refreshes a few seconds after the transaction finalizes)
await page.evaluate(() => document.getElementById("funds")?.scrollIntoView());
const before = await page.evaluate(() => document.querySelector(".fund-card")?.getAttribute("href"));
let href = before;
for (let i = 0; i < 60 && href === before; i++) {
  await sleep(3000);
  href = await page.evaluate(() => document.querySelector(".fund-card")?.getAttribute("href"));
}
log("3 newest fund link", href, `(was ${before})`);
await page.evaluate((h) => { location.hash = h.replace(/^#?/, "#"); }, href);
await waitText("propose an allocation");
await shot("fund");

// 4. propose
await click("button", "Propose an allocation");
await waitText("evidence (1 of 3)");
await page.type("#target", "sunrow energy");
await page.type("#amount", "1");
await page.type("#payee", "0x1111111111111111111111111111111111111111");
await page.type("#thesis", "Utility-scale solar and grid batteries, per the cited project update.");
await page.type("#u0", EVIDENCE);
await click("button", "Compute");
await waitText("characters committed", 60000);
await shot("propose-form");
log("4 fingerprint computed in the browser");
await click("button", "Propose with");
await sleep(800);
await click("dialog button", "Propose");
await waitText("proposed.", 360000);
log("4 proposal filed");

// 5. open it and ask the jury
await click("a", "Back to the fund");
await waitText("sunrow energy");
await click("a", "sunrow energy");
await waitText("awaiting jury");
await shot("proposal-pending");
await click("button", "Ask the jury");
log("5 jury round sent");
await waitText("approved, in appeal window", 420000).catch(async () => {
  log("not approved; page says:", (await text()).match(/(rejected|awaiting jury|approved[^\n]*)/)?.[0]);
});
await sleep(8000);
await shot("proposal-decided");
const body = await text();
log("5 result:", body.match(/approved, in appeal window|rejected|awaiting jury/)?.[0]);
log("   in theme:", /in theme[^\n]*\n[^\n]*\n?true|in theme\s*true/.test(body) ? "true" : "(see screenshot)");
log("   votes line:", body.match(/\d of \d validators[^\n]*/)?.[0] ?? "(not shown yet)");
await browser.close();
