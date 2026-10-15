# Mandate

**A treasury that can only act inside a written mandate, and checks the world before it does.**

Members fund a treasury and freeze a plain-English **mandate** ("renewable energy, no more than X% in any single name, avoid projects with documented labor issues"). Anyone can **propose** an allocation with public evidence (news, filings, project updates). GenLayer validators each fetch that evidence themselves and answer one fixed schema of four booleans. Everything else is ordinary code. Members **do not vote on every rebalance**; they **appeal one specific trade**, with a bond and a public page, inside a window.

There is no admin key, no operator, no backend model and no oracle. Mandate, caps, bonds and timings are frozen at creation.

> **Status.** The contract is linted, tested in GenLayer's Direct Mode (109 tests) and **deployed to Studionet**, with a demo fund seeded through real validator consensus. The web app type-checks, builds and passes 38 unit tests. Appeals, execution and the standing watch have each been exercised live once; expiry and redemption have **only** been exercised in Direct Mode, which mocks the web fetches and the model. See [Known limitations](#known-limitations).

**Live evidence (Studionet).** Contract [`0x2dE196c3203a77bB420aC696c7eb3CeC6EE16A68`](https://explorer-studio.genlayer.com/address/0x2dE196c3203a77bB420aC696c7eb3CeC6EE16A68). `web/scripts/seed.mjs` created the *Green Transition Treasury* fund and ran these rounds against real Wikipedia pages. Every verdict is what the validators returned, nothing was hand-written:

| Step | Transaction | Result |
| --- | --- | --- |
| Create fund (frozen mandate, 25% / 10% caps, one watch page) | `0x2f309f0d…868a6c67` | fund 1 |
| Proposal: utility-scale solar (*Solar power* page) | `0xaed01100…484e8af2` | **approved**, later **executed** (`0xdd7fddff…6b023fa2`) |
| Proposal: coal mining (*Coal* page) | `0x8916c0b5…5138ab91` | **rejected**, bond slashed (off-mandate: the mandate excludes fossil fuels) |
| Proposal: onshore wind (*Wind power* page) | `0xf096c0cc…485d8954` | **approved** |
| Member appeal against wind (*Wind turbine syndrome* page) | `0x6cd3c2eb…853dfb9a` → `0x798fa8e4…f779dc9e` | jury **dismissed** the appeal, appeal bond kept by the treasury |
| Standing-watch scan | `0xfccbb839…85194d29` | **clear** |
| Proposal: hydropower | `0x68643d45…4b105167` | **approved** |
| Proposal: geothermal | (left unresolved) | **awaiting the jury**, so a reviewer can run a live round from the UI |

Deployment parameters: retry gap 1 h, 3 unreachable attempts, proposal expiry 14 days, scan gap 10 min (fixed forever). Full log: [docs/demo-seed.json](docs/demo-seed.json).

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
anyone     execute(id)  (after the window)                           GEN paid to the payee, bond returned
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

Validators accept the leader **only when all four normalized fields and the deterministic `source` check equal their own independently fetched result**. Prose is never compared.

**Deterministic mandate rules (enforced by the contract, not asked of a model)**

- An allocation may not exceed the per-trade cap, nor put more than the single-name cap into one target (counting executed positions **and** proposals still open), nor exceed the idle balance after what open proposals already earmark.
- One target name has exactly one payee address, fixed by its first proposal. A proposer cannot name themselves as payee.
- Evidence is committed by content fingerprint. A page that changes after filing is rejected and the bond slashed; an unreachable page is retried a bounded number of spaced times before it is dropped with the bond returned.
- Appeals are for members only, once per proposal, must bring a page not already weighed, and cost a bond. An upheld appeal cancels the allocation and sends the proposer's bond to the treasury. A failed appeal sends its bond to the treasury. An appeal whose page vanishes is dismissed without penalty.
- Nothing can be stuck: any proposal the jury has not settled by its expiry can be expired by anyone, returning bonds and releasing the earmark. Redemption opens once the fund has ended and no proposal is open, so nothing can be released into an empty pool.
- **A standing watch.** A fund may freeze up to three trusted watch pages at creation. `scan` (anyone, spaced by a fixed gap) has validators read those pages against what the fund holds and name the targets with documented adverse news. Frozen targets can receive no new proposals and no executions until a later scan clears them. A scan can only block; it never moves money. A scan that cannot read every page changes nothing.
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
npm test            # 38 unit tests, incl. fingerprint parity with the contract's own cleaner
npm run build
```

To point the app at a deployment, copy `web/.env.example` to `web/.env.local` and set `VITE_CONTRACT_ADDRESS`, or deploy a fresh contract to Studionet (gasless, throwaway key):

```bash
cd web
node --experimental-strip-types scripts/deploy.mjs      # prints CONTRACT_ADDRESS and writes web/.env.local
node --experimental-strip-types scripts/seed.mjs <addr>  # optional: a populated demo fund via real consensus (~10 min)
npm run dev                                              # http://localhost:5174
```

**Evidence fingerprints.** A proposer commits to the sha256 of each page's *cleaned text* (markup stripped from real HTML only, first 8,000 characters). The web app computes it in the browser when the site allows cross-origin reads; otherwise `npm run fingerprint -- <url>` prints the same value. `tests/vectors/fingerprint.json` is generated by the contract's own cleaner and asserted in both Python and TypeScript.

| | |
| --- | --- |
| Network | GenLayer Studionet (chain id `61999`, RPC `https://studio.genlayer.com/api`) |
| Contract | `0x2dE196c3203a77bB420aC696c7eb3CeC6EE16A68` |
| Stack | GenLayer Intelligent Contract (Python), React + Vite + TypeScript, `genlayer-js` 1.1.8 |

## Known limitations

- **A scan that flags a target has not been run live** (the live scan returned *clear*); the freeze, unfreeze and execute-block behaviour is proven in Direct Mode only. Expiry and redemption are also Direct-Mode only.
- **Only these consensus paths are exercised live** (approve, reject, appeal-dismissed, clear scan, execute). The rest is proven in Direct Mode with mocked fetches and a mocked model. Real validators may disagree on borderline evidence; the answer space is four booleans so disagreement should be rare, but the contract's fail-safe is to move nothing (the proposal stays pending until it resolves or expires).
- **A model reads the evidence.** It can be wrong. A hostile watch page could freeze a holding (never move money), so choose watch sources you trust. The appeal window, the bonds and the deterministic caps bound the damage; they do not remove it. A wrong jury is a protocol appeal.
- **It reads pages, not prices.** The standing watch reads public pages (news, regulator notices, filings); there is no price feed.
- **Proposals are open to anyone with a bond.** The contract does not decide *which* in-mandate allocations are good, only which are inside the mandate. A proposer who can write a convincing in-theme thesis with real evidence can win approval for a poor allocation; members' defense is the appeal.
- **No treasurer, no rebalancing engine.** Nothing selects or sizes trades on its own.
- **Studionet is a shared test network** and can be reset.

## Roadmap

Scheduled (rather than caller-triggered) scans; execution re-check against fresh evidence; per-target weighting rather than flat caps; token and bridge execution; a live end-to-end suite and recorded demo.
