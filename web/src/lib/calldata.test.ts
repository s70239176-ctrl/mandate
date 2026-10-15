import test from "node:test";
import assert from "node:assert/strict";
import { decodeCalldata, decodeReceiptResult } from "./calldata.ts";

const b64 = (bytes: number[]) => Buffer.from(bytes).toString("base64");
const utf = (s: string) => [...Buffer.from(s)];
const str = (s: string) => [(s.length << 3) | 4, ...utf(s)];

test("scalars", () => {
  assert.equal(decodeCalldata(Uint8Array.from([0])), null);
  assert.equal(decodeCalldata(Uint8Array.from([8])), false);
  assert.equal(decodeCalldata(Uint8Array.from([16])), true);
  assert.equal(decodeCalldata(Uint8Array.from([(5 << 3) | 1])), 5n);
  assert.equal(decodeCalldata(Uint8Array.from([(2 << 3) | 2])), -3n);
  assert.equal(decodeCalldata(Uint8Array.from(str("high"))), "high");
});

test("a multi-byte (uleb128) integer", () => {
  // 1_000_000 << 3 = 8_000_000 -> uleb128
  let n = 8_000_000 | 1;
  const out: number[] = [];
  while (n > 0x7f) {
    out.push((n & 0x7f) | 0x80);
    n >>>= 7;
  }
  out.push(n);
  assert.equal(decodeCalldata(Uint8Array.from(out)), 1_000_000n);
});

test("the contract's {ok,id,reason} return value", () => {
  const body = [(3 << 3) | 6, ...[2, ...utf("id")], (7 << 3) | 1, ...[2, ...utf("ok")], 16, ...[6, ...utf("reason")], ...str("")];
  // map keys must be sorted: id, ok, reason
  const r = decodeReceiptResult(b64([0, ...body]));
  assert.deepEqual(r, { kind: "return", value: { id: 7n, ok: true, reason: "" } });
});

test("a refusal payload is raw text, and junk is unknown", () => {
  assert.deepEqual(decodeReceiptResult(b64([1, ...utf("bad url")])), { kind: "refusal", message: "bad url" });
  assert.deepEqual(decodeReceiptResult(b64([2, ...utf("exit_code 1")])), { kind: "vm-error", message: "exit_code 1" });
  assert.deepEqual(decodeReceiptResult(""), { kind: "unknown" });
  assert.deepEqual(decodeReceiptResult(undefined), { kind: "unknown" });
});

test("a real leader receipt from Studionet decodes", () => {
  // "ACRoaWdo" is the contract's string return "high" (captured live)
  assert.deepEqual(decodeReceiptResult("ACRoaWdo"), { kind: "return", value: "high" });
});
