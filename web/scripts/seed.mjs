// Seed one demo fund on a deployed Mandate contract using REAL consensus rounds, so a reviewer opens a populated app.
//   node --experimental-strip-types scripts/seed.mjs <contract address>
// Every verdict below is whatever the validators actually returned; nothing is mocked or hand-written.
// Targets are sector names backed by public reference pages (a demo, not market data).
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { addressOf, clientFor, freshKey, returnOf, sleep, view, write } from "./chain-lib.mjs";
import { fingerprintUrl } from "../src/lib/fingerprint.ts";

const address = process.argv[2];
if (!/^0x[0-9a-fA-F]{40}$/.test(address ?? "")) throw new Error("usage: seed.mjs <contract address>");
const GEN = 10n ** 18n;
const WINDOW = 180;
const wiki = (p) => `https://en.wikipedia.org/wiki/${p}`;

const log = [];
const note = (what, r) => {
  const row = { what, status: r.status, revert: r.revert ?? null, result: returnOf(r.tx), hash: r.hash };
  log.push(row);
  console.log(what, "→", r.status, r.revert ?? "", JSON.stringify(row.result), r.hash);
  if (r.revert) throw new Error(`${what} refused: ${r.revert}`);
  return row.result;
};

const creator = freshKey();
const proposers = [freshKey(), freshKey(), freshKey(), freshKey(), freshKey()];
const read = clientFor();

const MANDATE = `Theme: renewable energy generation and storage: solar, wind, hydro, geothermal and grid batteries.
Exclusions: fossil-fuel extraction and generation (coal, oil, gas), and any project with documented labor-rights violations or fatal safety incidents.
Evidence standard: a named, public source describing the target's actual business. A thesis without support in the evidence does not count.`;

const ends = Math.floor(Date.now() / 1000) + 60 * 86400;
const fundTx = await write(clientFor(creator), address, "create_fund",
  ["Green Transition Treasury", MANDATE, 2500n, 1000n, GEN / 2n, GEN / 2n, BigInt(WINDOW), BigInt(ends), [wiki("Renewable_energy")], GEN / 20n],
  100n * GEN, "ACCEPTED");
const fundId = note("create_fund", fundTx).id;
const fund = await view(read, address, "get_fund", [BigInt(fundId)]);

async function propose(i, target, page, amount, thesis) {
  const fp = await fingerprintUrl(wiki(page));
  const client = clientFor(proposers[i]);
  const r = await write(client, address, "propose",
    [BigInt(fundId), target, addressOf(freshKey()), amount * GEN, thesis, [wiki(page)], [fp.hash]], BigInt(fund.bond), "ACCEPTED");
  return { id: note(`propose ${target}`, r).id, client };
}
const resolve = async (p, label) => note(`resolve ${label}`, await write(p.client, address, "resolve_proposal", [BigInt(p.id)], 0n, "ACCEPTED"));

const solar = await propose(0, "utility-scale solar", "Solar_power", 8n, "Photovoltaic and concentrated solar generation, per the cited reference page.");
const wind = await propose(1, "onshore wind", "Wind_power", 6n, "Wind-turbine generation capacity, per the cited reference page.");
const coal = await propose(2, "coal mining", "Coal", 5n, "High-yield energy commodity exposure.");
const hydro = await propose(3, "hydropower", "Hydroelectricity", 7n, "Hydroelectric generation, per the cited reference page.");
const geo = await propose(4, "geothermal", "Geothermal_energy", 4n, "Geothermal heat and power, per the cited reference page.");

const solarVerdict = await resolve(solar, "solar");
await resolve(coal, "coal");
await resolve(wind, "wind");
await resolve(hydro, "hydro");

// A member appeals the wind allocation inside its window with a different public page.
const appealUrl = wiki("Wind_turbine_syndrome");
const afp = await fingerprintUrl(appealUrl);
note("appeal wind", await write(clientFor(creator), address, "appeal", [BigInt(wind.id), appealUrl, afp.hash], BigInt(fund.appeal_bond), "ACCEPTED"));
note("resolve_appeal wind", await write(clientFor(creator), address, "resolve_appeal", [BigInt(wind.id)], 0n, "ACCEPTED"));

// Run one standing-watch scan over what the fund now holds or has earmarked.
note("scan", await write(clientFor(creator), address, "scan", [BigInt(fundId)], 0n, "ACCEPTED"));

// Let the solar window elapse, then execute it. geothermal is deliberately left awaiting its jury.
if (solarVerdict === "approved") {
  console.log(`waiting ${WINDOW + 20}s for the solar appeal window to close…`);
  await sleep((WINDOW + 20) * 1000);
  // execute now runs a LAST LOOK: validators re-read the evidence live before any GEN moves.
  note("execute solar", await write(clientFor(creator), address, "execute", [BigInt(solar.id)], 0n, "ACCEPTED"));
  note("execute wind", await write(clientFor(creator), address, "execute", [BigInt(wind.id)], 0n, "ACCEPTED"));
}

// A second, minimal fund aimed at the standing watch: its watch page documents a fatal incident for a target
// the fund holds (earmarked), which the mandate excludes. Whatever the validators answer is recorded as-is.
const watchFund = await write(clientFor(creator), address, "create_fund",
  ["Watchdog Demo Fund", MANDATE, 5000n, 2000n, GEN / 20n, GEN / 20n, BigInt(WINDOW), BigInt(ends), [wiki("Deepwater_Horizon_oil_spill")], 0n],
  10n * GEN, "ACCEPTED");
const watchFundId = note("create_fund (watchdog)", watchFund).id;
const wfund = await view(read, address, "get_fund", [BigInt(watchFundId)]);
const dfp = await fingerprintUrl(wiki("Offshore_drilling"));
const dh = await write(clientFor(proposers[0]), address, "propose",
  [BigInt(watchFundId), "deepwater horizon", addressOf(freshKey()), 1n * GEN, "Offshore drilling operator, per the cited reference page.", [wiki("Offshore_drilling")], [dfp.hash]],
  BigInt(wfund.bond), "ACCEPTED");
note("propose deepwater horizon", dh);
const scanResult = note("scan (watchdog)", await write(clientFor(creator), address, "scan", [BigInt(watchFundId)], 0n, "ACCEPTED"));
const retry = await write(clientFor(proposers[1]), address, "propose",
  [BigInt(watchFundId), "deepwater horizon", addressOf(freshKey()), 1n * GEN, "Second attempt.", [wiki("Offshore_drilling")], [dfp.hash]],
  BigInt(wfund.bond), "ACCEPTED");
log.push({ what: "propose to the target after the scan", status: retry.status, revert: retry.revert ?? null, result: returnOf(retry.tx), hash: retry.hash });
console.log("watchdog scan →", scanResult, "| proposing to it afterwards →", JSON.stringify(returnOf(retry.tx)));

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "docs", "demo-seed.json");
writeFileSync(out, JSON.stringify({ address, fundId, watchFundId, geothermalProposalLeftPending: geo.id, log }, null, 1));
console.log("done; wrote docs/demo-seed.json");
