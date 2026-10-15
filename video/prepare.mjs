// Creates ONE fresh proposal on the live contract so the video can film a real jury round and a real execution.
//   node prepare.mjs   -> writes video/live.json { proposalId }
// (The proposal is made with a throwaway key; the film then asks the jury and executes it from the browser.)
import { writeFileSync } from "node:fs";
import { addressOf, clientFor, freshKey, returnOf, view, write } from "../web/scripts/chain-lib.mjs";
import { fingerprintUrl } from "../web/src/lib/fingerprint.ts";

const ADDRESS = "0x91bCDA69Bedb0a5F15E88e37a36CAcEC92a09646";
const URL = "https://en.wikipedia.org/wiki/Pumped-storage_hydroelectricity";
const TARGET = "pumped hydro storage";
const THESIS = "Pumped-storage hydropower that stores renewable energy for the grid, per the cited reference page.";
const fp = await fingerprintUrl(URL);
if ((await fingerprintUrl(URL)).hash !== fp.hash) throw new Error("page is not stable between two fetches");
const fund = await view(clientFor(), ADDRESS, "get_fund", [1n]);
const r = await write(
  clientFor(freshKey()),
  ADDRESS,
  "propose",
  [1n, TARGET, addressOf(freshKey()), 3n * 10n ** 18n, THESIS, [URL], [fp.hash]],
  BigInt(fund.bond),
  "ACCEPTED",
);
const out = returnOf(r.tx);
console.log("propose", r.status, r.revert ?? "", JSON.stringify(out), r.hash);
if (!out?.ok) process.exit(1);
writeFileSync("live.json", JSON.stringify({ proposalId: out.id, hash: r.hash, url: URL, target: TARGET, thesis: THESIS, amount: "3" }, null, 1));
console.log("wrote live.json");
