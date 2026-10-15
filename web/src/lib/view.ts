/** Presentation helpers: what a proposal's protocol state means, in plain words. Pure, no network. */
import type { Fund, Proposal } from "./types.ts";

export type Tone = "green" | "amber" | "red" | "gray" | "teal";

export function statusInfo(p: Proposal, now = Math.floor(Date.now() / 1000)): { label: string; tone: Tone } {
  switch (p.status) {
    case "PENDING":
      return { label: p.evidenceState === "unavailable" ? "Evidence unreachable, retrying" : "Awaiting jury", tone: "amber" };
    case "APPROVED":
      return now < p.executableAt ? { label: "Approved, in appeal window", tone: "teal" } : { label: "Approved, ready to execute", tone: "green" };
    case "APPEALED":
      return { label: "Appealed, awaiting jury", tone: "amber" };
    case "EXECUTED":
      return { label: "Executed", tone: "green" };
    case "REJECTED":
      return { label: "Rejected", tone: "red" };
    case "CANCELLED":
      return { label: "Cancelled by appeal", tone: "red" };
    case "EXPIRED":
      return { label: "Expired", tone: "gray" };
  }
}

const NOTES: Record<string, string> = {
  mandate_violation: "The evidence did not show an in-theme target, or documented something the mandate excludes. The proposer's bond went to the treasury.",
  adverse_event: "The evidence shows a material adverse development that undermines the thesis. The bond was returned.",
  evidence_changed: "An evidence page no longer matched its fingerprint, so the proposal was rejected without asking the jury. The bond went to the treasury.",
  evidence_unavailable: "An evidence page could not be loaded on every spaced attempt. The bond was returned.",
  appeal_upheld: "A member's appeal documented a violation or material adverse fact. The allocation was cancelled and the proposer's bond went to the treasury.",
  expired: "The proposal waited too long and was expired. Bonds were returned and the earmark released.",
};
export const noteText = (note: string): string => NOTES[note] ?? "";

export const bps = (n: number): string => `${(n / 100).toFixed(n % 100 === 0 ? 0 : 2)}%`;

export function fundSummary(f: Fund): string {
  return `${bps(f.maxSingleBps)} per name · ${bps(f.maxTradeBps)} per trade`;
}

export function windowText(seconds: number): string {
  if (seconds % 86400 === 0) return `${seconds / 86400} day${seconds === 86400 ? "" : "s"}`;
  if (seconds % 3600 === 0) return `${seconds / 3600} hours`;
  return `${Math.round(seconds / 60)} minutes`;
}

/** The ordered story of one proposal, each step marked done / now / later from real contract fields. */
export interface Step {
  title: string;
  detail: string;
  state: "done" | "now" | "later";
}

export function timeline(p: Proposal, now: number): Step[] {
  const steps: Step[] = [{ title: "Proposed", detail: "Allocation earmarked, evidence committed by fingerprint.", state: "done" }];
  if (p.status === "PENDING") {
    steps.push(
      { title: "Jury reads the evidence", detail: "Validators fetch every page themselves and judge it against the mandate.", state: "now" },
      { title: "Appeal window", detail: "Members may appeal this one trade.", state: "later" },
      { title: "Executed", detail: "Anyone can execute after the window.", state: "later" },
    );
    return steps;
  }
  if (p.status === "EXPIRED" && !p.evidenceState.match(/ok|changed|withdrawn/)) {
    steps.push({ title: "Expired", detail: noteText("expired"), state: "done" });
    return steps;
  }
  if (p.status === "REJECTED") {
    steps.push({ title: "Jury rejected it", detail: noteText(p.note), state: "done" });
    return steps;
  }
  steps.push({ title: "Jury approved it", detail: "Within the mandate.", state: "done" });
  if (p.status === "CANCELLED") {
    steps.push({ title: "Appeal upheld", detail: noteText("appeal_upheld"), state: "done" });
    return steps;
  }
  if (p.status === "EXPIRED") {
    steps.push({ title: "Expired", detail: noteText("expired"), state: "done" });
    return steps;
  }
  if (p.status === "APPEALED") {
    steps.push(
      { title: "Appealed", detail: "A member posted a bond and a public page. A second jury decides.", state: "now" },
      { title: "Executed", detail: "Only if the appeal fails.", state: "later" },
    );
    return steps;
  }
  const open = now < p.executableAt;
  const failed = ["DISMISSED", "UNAVAILABLE", "CHANGED"].includes(p.appealState);
  steps.push({
    title: failed ? "Appeal failed" : "Appeal window",
    detail: open ? "Open: members can appeal." : "Closed.",
    state: p.status === "EXECUTED" || !open ? "done" : "now",
  });
  steps.push({
    title: "Executed",
    detail: p.status === "EXECUTED" ? "GEN paid to the payee; the bond returned." : "Anyone can execute now.",
    state: p.status === "EXECUTED" ? "done" : open ? "later" : "now",
  });
  return steps;
}

export interface Stage {
  title: string;
  sub: string;
  state: "done" | "now" | "later" | "bad";
}

/** The four-stage journey of one proposal, from real contract fields, for the stepper. */
export function stages(p: Proposal, now: number): Stage[] {
  const open = now < p.executableAt;
  const s: Stage[] = [
    { title: "Proposed", sub: "Evidence committed", state: "done" },
    { title: "Jury", sub: "Validators read it", state: "later" },
    { title: "Appeal window", sub: "Members may object", state: "later" },
    { title: "Executed", sub: "GEN paid out", state: "later" },
  ];
  switch (p.status) {
    case "PENDING":
      s[1] = { ...s[1], state: "now", sub: p.evidenceState === "unavailable" ? "Page unreachable, retrying" : "Awaiting the jury" };
      break;
    case "REJECTED":
      s[1] = { title: "Rejected", sub: p.note === "adverse_event" ? "Adverse development" : p.note === "mandate_violation" ? "Outside the mandate" : "Evidence problem", state: "bad" };
      break;
    case "EXPIRED":
      s[1] = { title: "Expired", sub: "Released, bonds returned", state: "bad" };
      break;
    case "APPROVED":
      s[1] = { ...s[1], state: "done", sub: "Approved" };
      s[2] = { ...s[2], state: open ? "now" : "done", sub: open ? "Open now" : "Closed" };
      s[3] = { ...s[3], state: open ? "later" : "now", sub: open ? "After the window" : "Ready to execute" };
      break;
    case "APPEALED":
      s[1] = { ...s[1], state: "done", sub: "Approved" };
      s[2] = { ...s[2], state: "now", sub: "Under appeal" };
      break;
    case "CANCELLED":
      s[1] = { ...s[1], state: "done", sub: "Approved" };
      s[2] = { title: "Appeal upheld", sub: "Allocation cancelled", state: "bad" };
      break;
    case "EXECUTED":
      s[1] = { ...s[1], state: "done", sub: "Approved" };
      s[2] = { ...s[2], state: "done", sub: "Closed" };
      s[3] = { ...s[3], state: "done", sub: "Paid to the payee" };
      break;
  }
  return s;
}
