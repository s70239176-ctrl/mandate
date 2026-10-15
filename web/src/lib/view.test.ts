import assert from "node:assert/strict";
import { test } from "node:test";
import { REFUSALS, decodeRevert, toFund, toProposal } from "./decode.ts";
import { bps, statusInfo, timeline, windowText } from "./view.ts";

const rawProposal = (over: Record<string, unknown> = {}) => ({
  id: 1, fund_id: 1, proposer: "0xAA", target: "sunfield solar", payee: "0xBB", amount: 8000n, thesis: "t",
  urls: ["https://news.example.org/a"], hashes: ["a".repeat(64)], bond: 500n, status: "PENDING", in_theme: null,
  excluded: null, adverse: null, bond_outcome: "HELD", evidence_state: "", note: "", attempts: 0, last_attempt_at: 0,
  created_at: 100, decided_at: 0, executable_at: 0, executed_at: 0, expires_at: 9999, appellant: "", appeal_url: "",
  appeal_hash: "", appeal_bond: 0n, appeal_state: "", appeal_attempts: 0, appealed_at: 0, ...over,
});

test("toProposal keeps bigints, lowercases addresses and leaves an unjudged verdict null", () => {
  const p = toProposal(rawProposal());
  assert.equal(p.amount, 8000n);
  assert.equal(p.proposer, "0xaa");
  assert.equal(p.inTheme, null);
  assert.equal(p.appellant, "");
});

test("toFund reads positions and caps", () => {
  const f = toFund({
    id: 1, creator: "0xAA", name: "n", mandate: "m", max_single_bps: 2000, max_trade_bps: 1000, max_single: 20000n,
    max_trade: 10000n, bond: 1n, appeal_bond: 1n, appeal_window: 60, ends_at: 1, created_at: 0, total_stake: 100000n,
    redeemed_stake: 0n, pool: 100000n, reserved: 0n, free: 100000n, allocated: 0n, members: 1, proposal_ids: [], proposal_count: 0,
    positions: [{ target: "x", payee: "0xbb", allocated: 5n, reserved: 7n }], open: true,
  });
  assert.equal(f.positions[0].reserved, 7n);
  assert.equal(f.maxSingle, 20000n);
});

test("status labels come from real protocol state", () => {
  assert.equal(statusInfo(toProposal(rawProposal())).label, "Awaiting jury");
  assert.equal(statusInfo(toProposal(rawProposal({ evidence_state: "unavailable" }))).tone, "amber");
  assert.equal(statusInfo(toProposal(rawProposal({ status: "EXECUTED" }))).tone, "green");
  assert.equal(statusInfo(toProposal(rawProposal({ status: "CANCELLED" }))).tone, "red");
});

test("timeline: an approved proposal inside its window shows the window as now, then execution later", () => {
  const p = toProposal(rawProposal({ status: "APPROVED", evidence_state: "ok", executable_at: 500, decided_at: 100 }));
  const open = timeline(p, 200);
  assert.deepEqual(open.map((s) => s.state), ["done", "done", "now", "later"]);
  const after = timeline(p, 600);
  assert.deepEqual(after.map((s) => s.state), ["done", "done", "done", "now"]);
});

test("timeline: a rejected proposal ends with the reason", () => {
  const p = toProposal(rawProposal({ status: "REJECTED", evidence_state: "changed", note: "evidence_changed", decided_at: 120 }));
  const steps = timeline(p, 200);
  assert.equal(steps.length, 2);
  assert.match(steps[1].detail, /fingerprint/);
});

test("formatting helpers", () => {
  assert.equal(bps(2000), "20%");
  assert.equal(bps(1250), "12.50%");
  assert.equal(windowText(172800), "2 days");
  assert.equal(windowText(600), "10 minutes");
});

test("every refusal the contract can raise has plain-language text", () => {
  for (const key of ["concentration cap", "trade too large", "members only", "window closed", "proposals still open", "payee mismatch"]) {
    assert.ok(REFUSALS[key], key);
  }
});

test("decodeRevert reads a tagged utf-8 refusal and ignores garbage", () => {
  const payload = Buffer.from(Uint8Array.from([1, ...Buffer.from("members only")])).toString("base64");
  assert.equal(decodeRevert(payload), "members only");
  assert.equal(decodeRevert(""), undefined);
  assert.equal(decodeRevert(undefined), undefined);
});
