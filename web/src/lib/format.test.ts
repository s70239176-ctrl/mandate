import test from "node:test";
import assert from "node:assert/strict";
import { formatGen, parseGen } from "./format.ts";

test("parseGen / formatGen round trip", () => {
  assert.equal(parseGen("1.5"), 1500000000000000000n);
  assert.equal(parseGen("0.000000000000000001"), 1n);
  assert.equal(parseGen("1e3"), null);
  assert.equal(parseGen("-1"), null);
  assert.equal(parseGen(""), null);
  assert.equal(formatGen(1500000000000000000n), "1.5");
  assert.equal(formatGen(20n * 10n ** 18n), "20");
  assert.equal(formatGen(0n), "0");
});
