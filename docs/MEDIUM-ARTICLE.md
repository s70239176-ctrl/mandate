# A treasury that can only do what it said it would

### How I built a shared fund where the rulebook is locked, the limits are code, and independent reviewers read the evidence before any money moves

*Mandate is live at [mandate-virid.vercel.app](https://mandate-virid.vercel.app). It runs on a test network, so you can try everything with play money.*

---

## Two bad options

Imagine a group of people pooling money for a shared purpose: a community fund, a club treasury, a small investment group. Sooner or later someone proposes spending some of it, and the group has to decide how.

Most groups pick one of two ways, and both have a flaw.

**Vote on everything.** It is fair, and it is exhausting. Every purchase becomes a meeting. Interest fades, a handful of people end up deciding anyway, and the rest stop reading the proposals.

**Hand the keys to a few trusted people.** It is fast, and it only works for as long as the trust does. The rules the group agreed on live in a document nobody enforces, and the people holding the money are also the people who interpret it.

I wanted to try a third way: write the rules down once, lock them, and let the *rules* decide, with independent reviewers checking each proposal against them and everyone able to see how they decided.

## The idea, in one sentence

**Mandate is a shared fund that can only act inside a written mandate, and it checks public evidence before it moves any money.**

A *mandate* is a rulebook with a lock on it. Think of the charter of a fund: what it invests in, what it refuses to touch, how much it may put into any single thing. In Mandate the charter is plain English, written once when the fund is created, and then it cannot be changed. Not by the person who created it, not by me.

The logo is two triangles, one inside the other: a boundary, and what it contains. That is the product.

## How it works, in six steps

**1. Someone writes the mandate and locks it.**
For example: *"Renewable energy: solar, wind, hydro, geothermal and storage. Exclude fossil fuels and any project with documented labor-rights violations. Back every claim with a named public source."* They also set the limits (say, no more than 25% of the fund in any one name, and no more than 10% in a single trade), a waiting period, and an end date. All of it is frozen the moment the fund exists.

**2. Anyone can propose a spend.**
A proposal names a target, an amount and a payee, and points to one to three public web pages as evidence. The proposer also posts a small deposit as a promise of good faith. The proposal "fingerprints" each page when it is filed, which means it records exactly what the page said at that moment, so nobody can quietly swap the evidence later.

**3. Independent reviewers read the evidence.**
These reviewers, called validators, each open the pages themselves and answer the same four questions. Each forms an answer on their own before the answers are compared.

**4. Plain code checks the limits.**
Whatever the reviewers say, the fund's own code separately checks the things that are not matters of opinion: is the amount within the trade limit, would it break the cap on any one name, is there enough money sitting idle. No reviewer, human or machine, is asked about those.

**5. Then everyone gets a window to object.**
An approved spend does not pay out straight away. It waits. During that waiting period any member of the fund can challenge that one trade by posting a deposit and pointing to a *different* public page that shows a problem. A second jury then reads the challenge. Nobody has to vote on every spend. They only act when they can point to evidence.

**6. A last look, then payment.**
Approval can go stale. News can break between "approved on Monday" and "paid on Wednesday". So before any money moves, the reviewers re-read the evidence live. If something excluded or seriously bad has appeared, the payment is blocked. If not, it goes out, and the proposer's deposit comes back.

## The four questions

The jury's whole job is to answer four true-or-false questions about a proposal:

1. **Is there evidence?** Could the pages actually be read, and do they say anything about the target?
2. **Is it in theme?** Does the target's real business fit what the mandate says the fund is for?
3. **Is something excluded documented?** Does the evidence show something the mandate explicitly refuses, such as a labor-rights violation the fund said it would not touch?
4. **Is there a serious adverse development?** Insolvency, a fraud finding, a cancelled project, a regulatory ban.

Why four? Because a reviewer who can write paragraphs can be argued with, flattered or pressured. A reviewer who can only answer true or false cannot. For a result to stand, the independent reviewers must give the *same* four answers. Wording earns nothing.

When a proposal is turned down, the reviewer also names the *kind* of problem, such as "documented labor violation" or "excluded sector", so a rejection always comes with a reason you can read.

## What is deliberately not left to the AI

This is the part I care about most. A language model is good at reading a page and bad at arithmetic you must be able to audit. So the fund's own code, not the reviewers, handles:

- the limit on any single trade, and on any single name (counting money already paid *and* money promised to proposals still open),
- whether there is enough idle money,
- whether the evidence still matches its fingerprint,
- who may challenge a trade, and when,
- the table that decides what happens to each deposit,
- every payment.

The reviewers answer four questions. Everything that moves money is ordinary, predictable code. And there is a page in the app called **How it decides** that shows the exact instructions the reviewers are given, read live from the deployed contract. Nothing about the judgment is hidden.

## Watching it work

I seeded a demo fund with real runs, so everything below actually happened.

**A trade that went through.** I proposed paying into a pumped-hydro storage project, with a public encyclopedia page as the evidence. Five validators were on the case; three took part and all three agreed: in theme, nothing excluded, nothing adverse. The fund's own checks passed. After the waiting period I asked for the payment. The validators re-read the page live (the "last look"), found nothing wrong, and the money moved.

**A trade that was refused, and why.** I proposed paying into coal mining. The mandate excludes fossil fuels, so the jury said so, and the page showed the reason as `excluded_sector`. The proposer's deposit was kept by the fund.

**A reviewer stricter than I expected.** I once proposed a tidal-power project. The mandate listed solar, wind, hydro, geothermal and storage, and the jury marked tidal as *not in theme*. That surprised me, and it taught me something: a mandate should say what it means. The reviewers hold the fund to what it wrote, not to what it might have meant.

**A challenge.** A member challenged an approved wind-power trade by pointing to a different page, one about health complaints near turbines. The second jury read it and decided it did not document a violation of this mandate or a serious adverse fact about the target, so the challenge failed and the member's deposit stayed with the fund. The trade went on to pay.

**A holding that got frozen.** A fund can name up to three trusted web pages as its *standing watch*. Anyone can ask the reviewers to read those pages against what the fund holds. In my demo the watch page was an article about a well-known oil-rig disaster, and the fund held a proposal for a target named after it. The reviewers flagged it, the target was **frozen**, and a later proposal to pay into it was refused on the spot. A freeze can only *block* things. It can never move money.

## What about people who try to cheat?

**A page that tries to command the jury.** Page text is fenced off and labelled as untrusted data, never as instructions. A reviewer that obeyed "approve this" would give a different answer from an honest one, and consensus would reject it.

**Swapping the evidence after the fact.** The page is fingerprinted when filed. If it changes before the jury reads it, the proposal is turned down without even asking the model.

**A dead link.** The reviewers don't guess. They retry a few times, spaced apart, and if the page never loads the proposal ends and the deposit comes back. At the last-look stage a page that cannot be read blocks the payment rather than letting it through.

**Paying yourself.** A proposer cannot name their own address as the payee, and a target name is tied to one payee address for good.

**Spam.** Every proposal and every challenge needs a deposit, and each person can have only a few open at once.

**A jury that cannot agree.** If the reviewers disagree, nothing is decided and **no money moves**. The proposal waits, and anyone can ask again. If it waits too long, anyone can expire it, which returns the deposits and releases the money it had set aside.

**A hostile watch page.** If someone controls one of the fund's watch pages, the worst they can do is freeze a holding. That is why the fund's creator should pick sources they trust, and why a freeze can never take money out.

## Where the technology comes in

The hard part is that the product asks software to *read web pages and judge them*. Ordinary programs on a blockchain cannot do that. They move money and follow exact rules, but they cannot look at an article and decide whether it shows a labor violation.

Mandate is built on **GenLayer**, a blockchain designed for that gap. Its validators can open a web page, make a judgment, and agree with each other on the result in a way anyone can verify. Everything else in Mandate, the limits, the deposits and the payments, is plain code. The judgment is the only part that is not.

## What it can't do (yet)

- **It runs on a test network.** Everything is play money. That makes it safe to try and not yet something to put real funds into.
- **It moves one currency and trades nothing.** The fund holds a single token, and a "spend" is a payment to an address. It does not buy or sell assets, read market prices, or give investment advice.
- **The reviewers are a model, and models can be wrong.** The waiting period, the deposits and the code-enforced limits shrink the damage a wrong call can do. They do not remove it.
- **It decides whether a spend fits the mandate, not whether it is a good idea.** Someone who writes a convincing in-theme case with real evidence can win approval for a poor one. The members' defence is the challenge.
- **Some paths I have only tested in simulation.** I ran approvals, rejections, a challenge, a payment after a last look, and a flagging scan on the live network. A last look that *blocks* a payment, a challenge that succeeds, an expiry and the final payout of leftover money are covered by automated tests but I have not run them live yet.
- **Borderline evidence can stall.** Requiring the same four answers is strict, and that is deliberate: slow and safe over fast and wrong.

## Try it

Open [mandate-virid.vercel.app](https://mandate-virid.vercel.app) and click the account menu, then **Use demo account**. You do not need a wallet. Open the demo fund, read its locked mandate, look at how each proposal was decided, and visit **How it decides** to read the reviewers' exact instructions. Or build your own policy at the top of the page and ask a jury to rule on a proposal. The source is open at [github.com/s70239176-ctrl/mandate](https://github.com/s70239176-ctrl/mandate).

The question behind all of this is a simple one. If a group of people hand money to a shared purpose, why should how it gets spent rest on a document nobody enforces, or on a few people's goodwill, when it could rest on a rulebook that cannot move and reviewers who have to agree?

A mandate is only worth something if it binds. This one does.

---

*Mandate is an experiment, not a financial product. It does not trade assets, does not give investment advice, and only reads public web pages. It never runs anything it finds on them.*

---

### Notes for publishing

- **Suggested images** (all in the repo under `docs/screens/`): `home.jpg` as the header image; `policy-builder.jpg` under "How it works"; `fund.jpg` under the six steps; `jury-review.jpg` under "Watching it work"; `refusal-reason.jpg` beside the coal example; `executed-last-look.jpg` beside the last-look paragraph; `standing-watch.jpg` under the frozen-holding example.
- **Video:** the 90-second walkthrough (`video/out/mandate-demo.mp4`, built by the pipeline in `video/`) can be embedded after "Try it" once it is uploaded somewhere Medium can embed from (YouTube works).
- **Suggested tags:** Blockchain, Web3, DAO, Product Design, AI.
- **Length:** about 2,000 words, roughly a 9-minute read.
