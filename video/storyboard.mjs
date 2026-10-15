// The whole film in one place: scene order, caption copy and shot lengths (seconds). Total target: 90 s.
export const TARGET_SECONDS = 90;
export const XF = 0.45; // crossfade between shots

export const shots = [
  { id: "hero", seconds: 5, step: "", caption: "Mandate: a treasury that can only act inside a written mandate, and checks the world before it moves." },
  { id: "builder-limit", seconds: 5, step: "1 · Build the policy", caption: "Caps are enforced by the contract, not by a model. Proof is always on." },
  { id: "builder-details", seconds: 4, step: "1 · Build the policy", caption: "The mandate is plain English: what is in scope, what is excluded, and what counts as evidence." },
  { id: "builder-confirm", seconds: 5, step: "1 · Build the policy", caption: "Saving freezes the mandate, the caps and the watch pages on-chain. Nobody can change them afterwards." },
  { id: "fund-charter", seconds: 5, step: "2 · The fund", caption: "Every fund shows its frozen mandate and the rules the contract enforces." },
  { id: "fund-treasury", seconds: 5, step: "2 · The fund", caption: "GEN is allocated, earmarked or idle, and each name's room under its cap is always visible." },
  { id: "propose-form", seconds: 5, step: "3 · Propose", caption: "Anyone can propose an allocation with public evidence, committed by fingerprint." },
  { id: "proposal-pending", seconds: 3, step: "3 · Propose", caption: "The amount is earmarked at once. Now a jury has to read the evidence." },
  { id: "jury-running", seconds: 5, step: "4 · The jury", caption: "Real GenLayer validators each fetch the pages themselves and judge them against the mandate." },
  { id: "jury-done", seconds: 7, step: "4 · The jury", caption: "They agree on four true/false answers. Left: the contract's own checks. Right: the jury's verdict, with the real validator votes." },
  { id: "jury-evidence", seconds: 4, step: "4 · The jury", caption: "The jury read exactly the page that was fingerprinted when the proposal was filed." },
  { id: "refusal", seconds: 6, step: "4 · The jury", caption: "Outside the mandate? Rejected with a reason code, and the proposer's bond is slashed." },
  { id: "appeal", seconds: 6, step: "5 · Appeal", caption: "Any member can appeal one approved trade with a bond and a new public page. A second jury decides." },
  { id: "execute-running", seconds: 4, step: "6 · Execute", caption: "Before any GEN moves, validators re-read the evidence live: the last look." },
  { id: "executed", seconds: 5, step: "6 · Execute", caption: "Clear, so it pays. Had they found something adverse, the trade would have been blocked." },
  { id: "watchdog", seconds: 7, step: "7 · Standing watch", caption: "A watch reads trusted pages and freezes any holding with documented adverse news. A later proposal to it is refused." },
  { id: "how", seconds: 4.5, step: "Nothing hidden", caption: "The exact validator instructions, and the rules that are never given to a model, are public." },
  { id: "endcard", seconds: 4, step: "", caption: "" },
];

export const total = () => shots.reduce((a, s) => a + s.seconds, 0);
