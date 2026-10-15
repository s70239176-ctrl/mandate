# Mandate: design (PRD, TRD, SDLC)

## 1. PRD

**One-line pitch.** A treasury that can only act inside a written mandate, and checks public evidence before it does.

**Problem.** Treasuries and investment DAOs either vote on every rebalance (slow, apathetic) or hand discretion to a small group (trusted). Neither lets a written mandate bind actual spending.

**Users.** Members who fund a treasury; proposers who bring a case for an allocation; any member who spots a problem with an approved allocation.

**Why GenLayer.** Deciding whether a target fits a mandate and whether public evidence documents an exclusion is judgment over untrusted prose from the web. A contract cannot read a page; a committee is the trust assumption being removed.

**The decision GenLayer makes.** For one proposal, over 1 to 3 committed public pages: `evidence_available`, `in_theme`, `excluded`, `adverse`. For one appeal: `evidence_available`, `substantiated`.

**MVP features.** Last look at execution; reason codes; keeper fees; proposer track records; the standing watch (`scan`); create a fund with a frozen mandate; contribute; propose with committed evidence; jury verdict; appeal window; appeal; execute; expire; redeem; failed-payment recovery.

**Out of scope.** Token trading, price feeds, other assets, scheduled scanning, weighting schemes, governance over the mandate (it is frozen), an admin.

**Verdict structure.** Four booleans (proposal) and two booleans (appeal), plus a deterministic `source` check (`ok`, `changed`, `unavailable`) that never reaches the model.

**Risks.** Validator disagreement on borderline evidence (fail-safe: nothing moves); model error (bounded by the appeal window, bonds and caps); prompt injection from evidence pages (fenced as data, injected answers differ from honest validators and are rejected); unavailable evidence (bounded retries); proposer griefing (bonds, per-proposer open limit); stuck jury (expiry).

## 2. TRD

**Stack.** Python Intelligent Contract (`contracts/mandate.py`); React + Vite + TypeScript frontend with `genlayer-js` 1.1.8; no backend and no database. All state the UI shows is read from the contract.

**Storage.** `funds`, `proposals` (dataclass records), `stakes`, `positions`, `target_reserved`, `target_payee`, `open_by_proposer`, `failed_payments` (TreeMaps keyed `"fund|…"`). Deployment parameters `retry_gap`, `max_unavailable`, `proposal_expiry` are immutable.

**Writes.** `create_fund`, `contribute`, `propose`, `resolve_proposal`, `appeal`, `resolve_appeal`, `execute`, `expire_proposal`, `redeem`, `recover_failed_payment`. Payable calls that refuse return `{ok:false, reason}` and pay the attached value back, rather than raising (a raising transaction keeps its value on this runtime). **Views.** `get_params`, `get_fund`, `list_funds`, `get_proposal`, `list_proposals`, `get_stake`, `get_redeemable`, `get_failed_payment`, `get_failed_total`.

**Consensus.** `gl.vm.run_nondet_unsafe(leader_fn, validator_fn)`. The leader and every validator run the same `_judge`: fetch every page, check the deterministic source state, and only then prompt. The validator accepts the leader iff the **entire normalized result dict** equals its own. Garbage results fail with `"bad judgment"` and leave the proposal pending.

**Deterministic rules.** `check_caps` (trade cap, single-name cap including open earmarks, idle balance), `decide` (settlement table), `redeem_amount` (pro-rata). All are pure functions, unit-tested directly.

**Money.** The pool is the sum of idle GEN. `reserved` is what open proposals earmark; `pool - reserved` is free. Slashed bonds join the pool and belong to members pro rata. Every outgoing transfer is emitted `on="finalized"`. The test suite asserts conservation after almost every state change: GEN attached equals GEN paid out plus GEN the contract still accounts for.

**Evidence commitment.** `clean_page` strips markup only from real HTML, defuses our own prompt delimiters, collapses whitespace, and truncates to 8,000 code points; `content_hash` is sha256 of that text. The TypeScript mirror is verified against vectors the contract generates.

**Last look.** `execute` runs the same leader/validator pattern over the proposal's evidence URLs, read live with no fingerprint check (pages may legitimately change). The model returns `{excluded, adverse}` plus kinds; validators compare `(excluded, adverse, source)`. Clear: the payout proceeds in the same transaction. Flagged: the proposal ends REJECTED with note `last_look_blocked`, the earmark is released and the bond returned. Unavailable: counted, retried after `retry_gap`, and after `max_unavailable` attempts it fails closed (also bond returned).

**Reason codes.** Results carry `kinds` = `{excluded_kind, adverse_kind}`. `normalize_kinds` forces `none` exactly when the boolean is false and collapses unknown or missing kinds to `other`; `core_of` strips the kinds so validators never compare them. The stored `reason` is derived deterministically from the booleans and the leader's kind.

**Keeper fees.** `keeper_fee` is fixed at creation (at most 1% of the seed). `_keeper` pays the caller from `pool - reserved` only, after a settled step (jury round, appeal, execution, block, expiry or scan), and skips the payment when idle GEN is below the fee.

**Track records.** `stat_counts` keyed `kind|address` plus a bounded roster (200 proposers); `list_proposers` ranks by executions.

**Standing watch.** `scan` runs the same leader/validator pattern over the fund's frozen watch pages and its held targets (executed or earmarked, plus anything already frozen so it can be cleared). The jury returns `{flagged: [names]}`; each name must be one of the targets it was given or the whole result is invalid, and the contract compares the sorted set. The result replaces the frozen set. `propose` and `execute` refuse a frozen target. If any watch page cannot be read the scan returns `unavailable` and changes nothing. It can only block, so a manipulated watch page can pause a holding but never move money.

**Prompt design.** Fixed instructions; mandate and thesis and each page fenced in delimited blocks; an explicit rule that page text is data and never instructions; strict four-key JSON; prose outside the schema dropped, never compared. Concentration and size are deliberately not in the prompt.

**Environment.** `VITE_CONTRACT_ADDRESS`. Network (Studionet) is fixed in `web/src/lib/chain.ts`.

**Security notes.** No admin or privileged path. Self-payment blocked. One payee per target. Appeals members-only and must bring new evidence. HTTPS-only, no-credentials, no-port, no-IP, no-local-host URL validation (defense in depth; validator egress policy still matters). The app signs only through a wallet or a labelled throwaway demo key.

## 3. SDLC

| Phase | Goal | Exit criteria | State |
| --- | --- | --- | --- |
| 0 | Idea and design | This document | done |
| 1 | Contract MVP | Loads, lints, full flow in Direct Mode | done: `genvm-lint` passes, 143 tests |
| 2 | Frontend MVP | Create, contribute, propose, judge, appeal, execute, redeem from the UI | done: builds, 43 unit tests, rendered and spot-checked in a browser without a contract |
| 3 | Hardening | Bad inputs, failure states, conservation | done in Direct Mode |
| 4 | Deployment | Deployed to Studionet and exercised under real consensus | deployed and seeded; approve, reject, appeal, flagging scan, and execute-after-last-look run live; blocked-at-execution, upheld appeal, expire and redeem not yet run live |
| 5 | Submission polish | Live app, contract address, demo, honest limitations | not done |
