import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { cleanPage, contentHash, fingerprintUrl, isHash } from "./fingerprint.ts";

interface Vector {
  name: string;
  body_hex: string;
  content_type?: string;
  text: string;
  hash: string;
}

// generated from the contract's own cleaner (tests/direct/test_make_vectors.py); the Python suite asserts the same file
const vectors: Vector[] = JSON.parse(readFileSync(new URL("../../../tests/vectors/fingerprint.json", import.meta.url), "utf8"));

test("there are enough vectors to mean something", () => {
  assert.ok(vectors.length >= 15);
});

for (const v of vectors) {
  test(`parity with the contract: ${v.name}`, async () => {
    const bytes = Uint8Array.from(Buffer.from(v.body_hex, "hex"));
    const text = cleanPage(bytes, v.content_type);
    assert.equal(text, v.text);
    assert.equal(await contentHash(text), v.hash);
  });
}

test("isHash accepts only 64 lowercase hex characters", () => {
  assert.ok(isHash("a".repeat(64)));
  for (const bad of ["", "A".repeat(64), "a".repeat(63), "g".repeat(64)]) assert.ok(!isHash(bad));
});

test("fingerprintUrl fetches like a validator and hashes the cleaned page", async () => {
  const body = "Heap overflow.\n\n\n\nRepro here.";
  const fake = (async () =>
    new Response(body, { status: 200, headers: { "content-type": "text/plain" } })) as unknown as typeof fetch;
  const fp = await fingerprintUrl("https://writeups.example.org/a", fake);
  assert.equal(fp.text, "Heap overflow.\nRepro here.");
  assert.equal(fp.hash, await contentHash(fp.text));
});

test("fingerprintUrl explains a cross-origin refusal and a bad status", async () => {
  const blocked = (async () => {
    throw new TypeError("Failed to fetch");
  }) as unknown as typeof fetch;
  await assert.rejects(() => fingerprintUrl("https://x.example.org/a", blocked), /cross-origin/);
  const missing = (async () => new Response("", { status: 404 })) as unknown as typeof fetch;
  await assert.rejects(() => fingerprintUrl("https://x.example.org/a", missing), /HTTP 404/);
});
