// Live consensus check: propose an allocation backed by one public page, then ask the jury to resolve it.
//   node --experimental-strip-types scripts/live-propose.mjs <address> <fund_id> <evidence_url> [target]
import { clientFor, freshKey, addressOf, view, write, returnOf } from "./chain-lib.mjs";
import { fingerprintUrl } from "../src/lib/fingerprint.ts";

const [address, fundId, url, target = "solar power"] = process.argv.slice(2);
const a = await fingerprintUrl(url);
const b = await fingerprintUrl(url);
if (a.hash !== b.hash) throw new Error("page is not stable between two fetches; pick another URL");
console.log("fingerprint", a.hash, `${a.chars} chars`);

const key = freshKey();
const client = clientFor(key);
const payee = addressOf(freshKey());
const fund = await view(clientFor(), address, "get_fund", [BigInt(fundId)]);
const p = await write(client, address, "propose",
  [BigInt(fundId), target, payee, 1000n, "Utility-scale solar generation, per the cited reference page.", [url], [a.hash]],
  BigInt(fund.bond), "ACCEPTED", (s) => console.log("propose status", s));
console.log("propose", p.status, p.revert, JSON.stringify(returnOf(p.tx)));
const id = returnOf(p.tx)?.id;
if (!id) process.exit(1);
const r = await write(client, address, "resolve_proposal", [BigInt(id)], 0n, "ACCEPTED", (s) => console.log("resolve status", s));
console.log("resolve", r.status, r.revert, JSON.stringify(returnOf(r.tx)), r.hash);
console.log("proposal", await view(clientFor(), address, "get_proposal", [BigInt(id)]));
