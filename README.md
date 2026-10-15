# Mandate

**A treasury that can only act inside a written mandate, and checks the world before it does.**

Members fund a treasury and freeze a plain-English **mandate** ("renewable energy, no more than X% in any single name, avoid projects with documented labor issues"). Anyone can **propose** an allocation with public evidence (news, filings, project updates). GenLayer validators each fetch that evidence themselves and answer one fixed schema of four booleans. Everything else is ordinary code. Members **do not vote on every rebalance**; they **appeal one specific trade**, with a bond and a public page, inside a window.

There is no admin key, no operator, no backend model and no oracle. Mandate, caps, bonds and timings are frozen at creation.

> **Status.** The contract is linted, tested in GenLayer's Direct Mode (143 tests) and **deployed to Studionet**, with two demo funds seeded through real validator consensus. The web app type-checks, builds and passes 43 unit tests. Approve, reject, appeal, last-look execution and a flagging watchdog scan have each been run live. Expiry, redemption and the "last look blocks a trade" path have **only** been exercised in Direct Mode, which mocks the web fetches and the model. See [Known limitations](#known-limitations).

**Live evidence (Studionet).** Contract [`0x91bCDA69Bedb0a5F15E88e37a36CAcEC92a09646`](https://explorer-studio.genlayer.com/address/0x91bCDA69Bedb0a5F15E88e37a36CAcEC92a09646). `web/scripts/seed.mjs` created two funds and ran these rounds against real Wikipedia pages. Every verdict is what the validators returned; nothing was hand-written.

*Green Transition Treasury* (fund 1, keeper fee 0.05 GEN):

| Step | Transaction | Result |
| --- | --- | --- |
| Create fund (frozen mandate, 25% / 10% caps, one watch page) | `0xe5eeb7d1…b1a1f7a4` | fund 1 |
| Proposal: utility-scale solar (*Solar power*) | `0xdf018759…c919e918` | **approved**, then **executed** after a clear last look (`0x34b3d3b0…e6317f2d`) |
| Proposal: coal mining (*Coal*) | `0xb3ff3192…8cacbe51` | **rejected** (mandate excludes fossil fuels), bond slashed |
| Proposal: onshore wind (*Wind power*) | `0x5d321a8c…8fc2ba2f` | **approved**, appealed, then **executed** (`0x40740cd7…e63dd728`) |
| Member appeal against wind (*Wind turbine syndrome*) | `0x50e472bd…b5445b73` → `0x4954ae20…586a5f44` | jury **dismissed** it; the appeal bond stayed with the treasury |
| Standing-watch scan | `0xf66a828d…fb0353e4` | **clear** |
| Proposal: hydropower | `0xf4d318d9…6d5a4c3a` | **approved** (ready to execute) |
| Proposal: geothermal | (left unresolved) | **awaiting the jury**, so a reviewer can run a live round from the UI |

*Watchdog Demo Fund* (fund 2): its single watch page is the *Deepwater Horizon oil spill* article, and the fund holds (earmarks) a proposal for a target named `deepwater horizon`. The scan (`0x54827025…970e9577`) returned **flagged**, so the target was **frozen**; a later proposal to it (`0xaaf82ff8…d449c78a`) was refused with `target frozen` and the proposer's bond refunded.

Deployment parameters: retry gap 1 h, 3 unreachable attempts, proposal expiry 14 days, scan gap 10 min (fixed forever). Full log: [docs/demo-seed.json](docs/demo-seed.json). A 3-minute walkthrough script: [docs/DEMO.md](docs/DEMO.md).

## Why this needs GenLayer

"Does this target fit the mandate, and does the evidence document anything the mandate excludes?" is a judgment over untrusted prose from the open web. A normal contract cannot read a page, and a human committee is the trusted party a treasury is trying to avoid. GenLayer lets independent validators each read the evidence and agree on four booleans, and lets the contract act on that answer.

What is **not** judged by a model: the concentration cap, the trade-size cap, the idle balance, the evidence commitment, the timelock and the settlement table. Those are deterministic code.

## How it works

```
member     create_fund(mandate, caps, bonds, window, end) + GEN     mandate & caps frozen
member     contribute(fund)                                          adds stake (= member)
anyone     propose(fund, target, payee, amount, thesis,              earmarks the amount; commits each
                   urls[1..3], hashes[]) + bond                      evidence page by sha256 fingerprint
anyone     resolve_proposal(id)                                      validators fetch every page, answer 4 fields
contract   decide(four fields)   ──►  APPROVED | REJECTED             appeal window starts on approval
member     appeal(id, url, hash) + appeal bond   (once, in window)   second jury reads the appeal page
anyone     resolve_appeal(id)    ──►  CANCELLED | back to APPROVED
anyone     scan(fund)                                                validators read the fund's frozen watch pages;
                                                                     targets with documented adverse news are FROZEN
anyone     execute(id)  (after the window)                           LAST LOOK: validators re-read the evidence live;
                                                                     clear -> GEN paid to the payee, bond returned;
                                                                     adverse/excluded -> BLOCKED, nothing paid
anyone     expire_proposal(id)  (after the expiry)                   bounded way out of a stuck jury
member     redeem(fund)  (after the fund ends)                       pro-rata share of idle GEN
```

The only judgment on a proposal:

```json
{ "evidence_available": true, "in_theme": true, "excluded": false, "adverse": false }
```

| Result | Allocation | Proposer bond |
| --- | --- | --- |
| Evidence unavailable on every spaced attempt | rejected, earmark released | returned |
| An evidence page no longer matches its fingerprint | rejected without asking the model | slashed to the treasury |
| Off-theme, or documents something the mandate excludes | rejected | slashed to the treasury |
| Material adverse development that undermines the thesis | rejected | returned |
| In theme, nothing excluded, nothing adverse | **approved**, waits out the appeal window | held until execution, then returned |
| At execution: the live evidence now documents something excluded or adverse | **blocked**, earmark released | returned |
| At execution: the evidence cannot be read after the bounded retries | **blocked** (fails closed) | returned |

Validators accept the leader **only when all four normalized fields and the deterministic `source` check equal their own independently fetched result**. Prose is never compared.

**Deterministic mandate rules (enforced by the contract, not asked of a model)**

- An allocation may not exceed the per-trade cap, nor put more than the single-name cap into one target (counting executed positions **and** proposals still open), nor exceed the idle balance after what open proposals already earmark.
- One target name has exactly one payee address, fixed by its first proposal. A proposer cannot name themselves as payee.
- Evidence is committed by content fingerprint. A page that changes after filing is rejected and the bond slashed; an unreachable page is retried a bounded number of spaced times before it is dropped with the bond returned.
- Appeals are for members only, once per proposal, must bring a page not already weighed, and cost a bond. An upheld appeal cancels the allocation and sends the proposer's bond to the treasury. A failed appeal sends its bond to the treasury. An appeal whose page vanishes is dismissed without penalty.
- Nothing can be stuck: any proposal the jury has not settled by its expiry can be expired by anyone, returning bonds and releasing the earmark. Redemption opens once the fund has ended and no proposal is open, so nothing can be released into an empty pool.
- **A standing watch.** A fund may freeze up to three trusted watch pages at creation. `scan` (anyone, spaced by a fixed gap) has validators read those pages against what the fund holds and name the targets with documented adverse news. Frozen targets can receive no new proposals and no executions until a later scan clears them. A scan can only block; it never moves money. A scan that cannot read every page changes nothing.
- **Last look at execution.** Approval can go stale during the appeal window, so `execute` is itself judged: validators re-read the pages live and block the trade if they now document something the mandate excludes or a material adverse development. A page that merely *changed* is not a reason to block, and unreadable evidence fails closed after bounded retries with the bond returned.
- **Reason codes.** Every rejection carries a category (`off_theme`, `excluded_labor`, `adverse_fraud`, `last_look_adverse_insolvency`, ...). The kind of exclusion or adverse event is asserted by the leader and checked only for *consistency* with the booleans; it is never compared across validators, so a labor-versus-safety disagreement cannot stall consensus on the decision itself.
- **Keeper fees.** Nothing runs on a timer, so a fund may pay a small fixed fee (at most 1% of its seed, frozen at creation) from its **idle** pool to whoever settles a step: a jury round, an appeal, an execution, a scan or an expiry. It is never paid from earmarked GEN.
- **Proposer track records.** Approved, rejected, executed and overturned counts per proposer are kept on-chain and shown as a public leaderboard.
- **Nothing hidden.** `get_prompts` returns the exact instructions every validator receives and the list of rules that are never given to a model; the app's *How it decides* page renders them straight from the deployed contract.
- GEN moves only when a transaction **finalizes**. Failed transfers are recoverable through a per-recipient ledger.

Details and trade-offs: [docs/DESIGN.md](docs/DESIGN.md).

## What "allocation" means here

The treasury holds native GEN. An executed allocation is a **payment to the target's payee address**, tracked as a position against the target name. Mandate does not trade tokens, hold other assets, read prices from an exchange, or give investment advice. "Allocated" GEN is spent; members share any loss pro rata at redemption.

## Run it

Requirements: Python 3.12+, Node 20+.

```bash
pip install -r requirements.txt

# contract tests (Direct Mode; on Windows add the optional plugin)
python -m pytest tests/direct
PYTHONPATH=scripts python -m pytest tests/direct -p windows_direct_plugin     # Windows

# GenVM linter
genvm-lint check contracts/mandate.py

# web
cd web
npm install
npm test            # 43 unit tests, incl. fingerprint parity with the contract's own cleaner
npm run build
```

To point the app at a deployment, copy `web/.env.example` to `web/.env.local` and set `VITE_CONTRACT_ADDRESS`, or deploy a fresh contract to Studionet (gasless, throwaway key):

```bash
cd web
node --experimental-strip-types scripts/deploy.mjs      # prints CONTRACT_ADDRESS and writes web/.env.local
node --experimental-strip-types scripts/seed.mjs <addr>  # optional: a populated demo fund via real consensus (~10 min)
npm run dev                                              # http://localhost:5174
```

**The home page** is a "policy builder": a cinematic hero over a procedurally generated landscape (`web/scripts/make-hero.mjs` writes `public/hero.webp`; drop in your own image at that path to replace it) and a five-control builder whose controls map onto the contract: *Asset* (GEN is the only asset the treasury can hold), *Limit* (per-trade and per-name caps, enforced by the contract), *Condition* (the mandate's theme, read by the jury), *Require proof* (permanently on: every evidence page is fingerprint-committed, so it is shown as locked rather than as a toggle that could lie) and *Save policy* (creates the fund on-chain after a confirmation that states exactly what is frozen). The four category cards open and focus the matching control. Nothing on the page shows a policy as saved until the transaction is accepted.

**Evidence fingerprints.** A proposer commits to the sha256 of each page's *cleaned text* (markup stripped from real HTML only, first 8,000 characters). The web app computes it in the browser when the site allows cross-origin reads; otherwise `npm run fingerprint -- <url>` prints the same value. `tests/vectors/fingerprint.json` is generated by the contract's own cleaner and asserted in both Python and TypeScript.

| | |
| --- | --- |
| Network | GenLayer Studionet (chain id `61999`, RPC `https://studio.genlayer.com/api`) |
| Contract | `0x91bCDA69Bedb0a5F15E88e37a36CAcEC92a09646` |
| Stack | GenLayer Intelligent Contract (Python), React + Vite + TypeScript, `genlayer-js` 1.1.8 |

## Known limitations

- **Run live:** approve, reject, appeal-dismissed, clear scan, flagging scan with the follow-up proposal refused, and execution after a clear last look. **Direct-Mode only:** a last look that *blocks* a trade, an upheld appeal, expiry and redemption.
- **The last look can only block, never create, a trade, and fails closed:** a page that goes offline between approval and execution delays the trade and, after the bounded retries, cancels it (bond returned).
- **Reason kinds are leader-asserted.** The booleans decide; `excluded_labor` versus `excluded_safety` is a label and is never compared across validators.
- **No risk-tiered caps.** Letting the jury classify a target as low/medium/high risk and applying different caps was deliberately left out: the classification would have to be compared across validators like the booleans, which widens the consensus surface for a gain that flat caps already cover. The rest is proven in Direct Mode with mocked fetches and a mocked model. Real validators may disagree on borderline evidence; the answer space is four booleans so disagreement should be rare, but the contract's fail-safe is to move nothing (the proposal stays pending until it resolves or expires).
- **A model reads the evidence.** It can be wrong. A hostile watch page could freeze a holding (never move money), so choose watch sources you trust. The appeal window, the bonds and the deterministic caps bound the damage; they do not remove it. A wrong jury is a protocol appeal.
- **It reads pages, not prices.** The standing watch reads public pages (news, regulator notices, filings); there is no price feed.
- **Proposals are open to anyone with a bond.** The contract does not decide *which* in-mandate allocations are good, only which are inside the mandate. A proposer who can write a convincing in-theme thesis with real evidence can win approval for a poor allocation; members' defense is the appeal.
- **No treasurer, no rebalancing engine.** Nothing selects or sizes trades on its own.
- **Studionet is a shared test network** and can be reset.

## Roadmap

Scheduled (rather than caller-triggered) scans; per-target weighting rather than flat caps; bond discounts for good track records; token and bridge execution; a live end-to-end suite and recorded demo.
