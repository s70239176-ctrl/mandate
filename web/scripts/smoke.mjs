// Read-only smoke test against the deployed contract, then (with --write) create a fund with a throwaway key.
//   node --experimental-strip-types scripts/smoke.mjs <address> [--write]
import { clientFor, freshKey, view, write, returnOf, balanceOf, addressOf } from "./chain-lib.mjs";

const address = process.argv[2];
if (!/^0x[0-9a-fA-F]{40}$/.test(address ?? "")) throw new Error("usage: smoke.mjs <address> [--write]");
console.log("params", await view(clientFor(), address, "get_params"));
console.log("funds", (await view(clientFor(), address, "list_funds", [0n, 20n])).total);
if (process.argv.includes("--write")) {
  const key = freshKey();
  const client = clientFor(key);
  const now = Math.floor(Date.now() / 1000);
  const r = await write(client, address, "create_fund",
    ["Smoke Fund", "Theme: renewable energy. Exclusions: documented labor violations.", 2000n, 1000n, 10n ** 15n, 10n ** 15n, 600n, BigInt(now + 7 * 86400)],
    10n ** 18n, "ACCEPTED", (s) => console.log("status", s));
  console.log("result", r.status, r.revert, JSON.stringify(returnOf(r.tx)), r.hash);
}
