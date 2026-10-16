# Submission form: ready to paste

Character counts are checked against the form's limits. The how-to path was run end to end on the live site in a fresh browser profile on 2026-10-16 (demo account, create fund, fingerprint the evidence in the browser, file a proposal, ask the jury): the jury approved the proposal in about 40 seconds.

## 01 Project

**Project name:** Mandate

**Primary tag:** Governance

**Tag 1 / Tag 2:** pick the closest two topics the form offers inside Governance. Best fits: *treasury management* (or *DAO operations*) and *policy enforcement* (or *proposal review*). Mandate is a shared treasury whose spending is decided against a frozen written mandate, with appeals instead of votes.

## 02 Project summary

**One-liner (176/180):**

> A treasury bound by a locked, plain-English mandate: validators read public evidence, code enforces the limits, and members appeal single trades instead of voting on every one.

## 03 Project overview

**Description (867/1000):**

> Mandate is a shared fund bound by a written mandate. Its theme, exclusions, per-trade and per-name caps, bonds, timings and watch pages are frozen at creation: no admin. Anyone proposes a payment with one to three public evidence pages, fingerprinted when filed. Each GenLayer validator fetches the pages itself and answers four true/false questions (evidence, in theme, excluded, adverse); the result stands only if they agree, and a rejection carries a reason code. Plain code, never a model, enforces caps, idle balance, fingerprints, bonds and payments. Approved trades wait out an appeal window: a member can challenge one with a bond and a new page. Before any GEN moves, validators re-read the evidence live (last look). A standing watch freezes holdings with documented adverse news. Live on Studionet with real runs: approve, reject, appeal, execute, freeze.

## 04 Demo video

**Demo URL (optional):** leave blank until the video is uploaded to YouTube or X, then paste the direct post link. The 1:30 film (captions and soundtrack) is at `video/out/mandate-demo.mp4` and is rebuilt by the pipeline in `video/`.

## 05 How-to (the exact path)

Each item is one step: heading (optional) then instruction. Total time about 4 minutes. No wallet needed.

1. **Open the app.** Go to https://mandate-virid.vercel.app/ . Open the account menu (top right) and choose **Use demo account**. It is a throwaway key for test GEN.
2. **Save a policy.** In the **Policy builder** below the hero, leave the defaults (a renewable-energy mandate, 10 GEN seed) and click **Save policy**, then **Create fund** in the dialog. Wait about 40 seconds for "Fund created on-chain". Saving freezes the mandate and its limits.
3. **Open your fund.** Scroll to **Funds**. Your new fund is the first card (newest first; it can take a few seconds to appear). It has the same name as the demo fund. Open it, then click **Propose an allocation**.
4. **Propose with public evidence.** Target name `sunrow energy`, amount `1`, payee `0x1111111111111111111111111111111111111111`, any thesis. Public page 1: `https://raw.githubusercontent.com/s70239176-ctrl/mandate/main/fixtures/evidence/sunrow-solar.md` then click **Compute** (your browser fingerprints the page, shown as "characters committed"). Click **Propose with … GEN bond**, then **Propose** in the dialog. Wait about a minute for "Proposed".
5. **Ask the jury.** Click **Back to the fund**, open the `sunrow energy` proposal and click **Ask the jury**. Each validator fetches the page itself. Allow 30 to 90 seconds.
6. **Inspect the decision.** Compare **The contract's checks** (limits, payee, evidence commitment: plain code) with **The jury's answer** (four true/false answers and the real validator votes). Then open **How it decides** in the header to read the exact instructions the validators were given.

Shortcut (optional), already-decided examples on the seeded demo fund: https://mandate-virid.vercel.app/#/p/1 (approved and executed after a last look at the evidence), https://mandate-virid.vercel.app/#/p/3 (rejected, reason `excluded_sector`), https://mandate-virid.vercel.app/#/p/2 (approved, then appealed and the appeal dismissed), https://mandate-virid.vercel.app/#/f/2 (a standing watch that froze a target).

## 06 Review verification

**Expected verification outcome (466/500):**

> Approved, in appeal window. The jury's answer: pages matched fingerprints yes, in theme true, nothing excluded none, no material adverse none, with the validator votes (e.g. 3 of 5 agreed). The contract's checks all pass (per-trade and single-name caps, payee fixed, not frozen). No GEN has moved: it waits out the window, then Execute re-reads the evidence (last look). The jury is a model, so borderline pages can differ; this fixture was approved in the live run.

**Contract link 1:** https://explorer-studio.genlayer.com/address/0x91bCDA69Bedb0a5F15E88e37a36CAcEC92a09646

(Deploy transaction: https://explorer-studio.genlayer.com/tx/0xfb9d82adf3cb54f2427c734863129c07682e991f9e44af62227bc91a87774eb0)

## 07 Project links

**Website (required):** https://mandate-virid.vercel.app/

**GitHub:** https://github.com/s70239176-ctrl/mandate
