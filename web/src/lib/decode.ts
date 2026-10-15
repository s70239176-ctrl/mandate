/**
 * Pure decoding: contract view dictionaries -> typed objects, and contract refusals -> plain language.
 * No network, no environment: unit-tested in node.
 */
import type { AppealState, BondOutcome, EvidenceState, Fund, Params, Position, Prompts, Proposal, ProposalStatus, ProposerRecord } from "./types.ts";

/** genlayer-js may hand back Maps for contract dicts; normalise to plain objects (bigints kept). */
export function plain(v: unknown): unknown {
  if (v instanceof Map) return Object.fromEntries([...v.entries()].map(([k, x]) => [String(k), plain(x)]));
  if (Array.isArray(v)) return v.map(plain);
  if (v && typeof v === "object" && !(v instanceof Uint8Array)) {
    return Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, plain(x)]));
  }
  return v;
}

const big = (v: unknown): bigint => BigInt(v as never);
const num = (v: unknown): number => Number(v);
const nullable = <T,>(v: unknown, f: (x: unknown) => T): T | null => (v === null || v === undefined ? null : f(v));
const addr = (v: unknown): string => String(v).toLowerCase();

export type Raw = Record<string, unknown>;

export function toFund(r: Raw): Fund {
  return {
    id: num(r.id),
    creator: addr(r.creator),
    name: String(r.name),
    mandate: String(r.mandate),
    maxSingleBps: num(r.max_single_bps),
    maxTradeBps: num(r.max_trade_bps),
    maxSingle: big(r.max_single),
    maxTrade: big(r.max_trade),
    bond: big(r.bond),
    appealBond: big(r.appeal_bond),
    appealWindow: num(r.appeal_window),
    endsAt: num(r.ends_at),
    createdAt: num(r.created_at),
    totalStake: big(r.total_stake),
    redeemedStake: big(r.redeemed_stake),
    pool: big(r.pool),
    reserved: big(r.reserved),
    free: big(r.free),
    allocated: big(r.allocated),
    members: num(r.members),
    proposalIds: (r.proposal_ids as unknown[]).map(num),
    proposalCount: num(r.proposal_count),
    positions: (r.positions as Raw[]).map(
      (p): Position => ({ target: String(p.target), payee: String(p.payee), allocated: big(p.allocated), reserved: big(p.reserved) }),
    ),
    watchUrls: ((r.watch_urls as unknown[]) ?? []).map(String),
    frozen: ((r.frozen as unknown[]) ?? []).map(String),
    lastScanAt: num(r.last_scan_at ?? 0),
    scanCount: num(r.scan_count ?? 0),
    keeperFee: big(r.keeper_fee ?? 0),
    open: Boolean(r.open),
  };
}

export function toProposal(r: Raw): Proposal {
  return {
    id: num(r.id),
    fundId: num(r.fund_id),
    proposer: addr(r.proposer),
    target: String(r.target),
    payee: addr(r.payee),
    amount: big(r.amount),
    thesis: String(r.thesis),
    urls: (r.urls as unknown[]).map(String),
    hashes: (r.hashes as unknown[]).map(String),
    bond: big(r.bond),
    status: String(r.status) as ProposalStatus,
    inTheme: nullable(r.in_theme, Boolean),
    excluded: nullable(r.excluded, Boolean),
    adverse: nullable(r.adverse, Boolean),
    bondOutcome: String(r.bond_outcome) as BondOutcome,
    evidenceState: String(r.evidence_state ?? "") as EvidenceState,
    note: String(r.note ?? ""),
    attempts: num(r.attempts ?? 0),
    lastAttemptAt: num(r.last_attempt_at ?? 0),
    createdAt: num(r.created_at),
    decidedAt: num(r.decided_at),
    executableAt: num(r.executable_at),
    executedAt: num(r.executed_at),
    expiresAt: num(r.expires_at),
    appellant: r.appellant ? addr(r.appellant) : "",
    appealUrl: String(r.appeal_url ?? ""),
    appealHash: String(r.appeal_hash ?? ""),
    appealBond: big(r.appeal_bond ?? 0),
    appealState: String(r.appeal_state ?? "") as AppealState,
    appealAttempts: num(r.appeal_attempts ?? 0),
    appealedAt: num(r.appealed_at ?? 0),
    reason: String(r.reason ?? ""),
    excludedKind: String(r.excluded_kind ?? "none"),
    adverseKind: String(r.adverse_kind ?? "none"),
    lastlookState: String(r.lastlook_state ?? "") as Proposal["lastlookState"],
    lastlookAttempts: num(r.lastlook_attempts ?? 0),
  };
}

export function toProposer(r: Raw): ProposerRecord {
  return { address: addr(r.address), approved: num(r.approved), rejected: num(r.rejected), executed: num(r.executed), overturned: num(r.overturned) };
}

export function toPrompts(r: Raw): Prompts {
  return {
    proposal: String(r.proposal),
    appeal: String(r.appeal),
    lastLook: String(r.last_look),
    scan: String(r.scan),
    rules: ((r.deterministic_rules as unknown[]) ?? []).map(String),
  };
}

export function toParams(r: Raw): Params {
  return {
    retryGap: num(r.retry_gap),
    maxUnavailable: num(r.max_unavailable),
    proposalExpiry: num(r.proposal_expiry),
    scanGap: num(r.scan_gap ?? 0),
    maxUrls: num(r.max_urls),
  };
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** The contract's own refusal text: base64 (tag byte + utf-8) in a dry-run error or a leader receipt. */
export function decodeRevert(payload: unknown): string | undefined {
  if (typeof payload !== "string" || payload === "") return undefined;
  try {
    const bytes = fromB64(payload);
    const text = new TextDecoder().decode(bytes.subarray(bytes[0] !== undefined && bytes[0] <= 8 ? 1 : 0));
    return /^[\x20-\x7e]{1,80}$/.test(text) ? text : undefined;
  } catch {
    return undefined;
  }
}

export const REFUSALS: Record<string, string> = {
  "empty seed": "Attach some GEN: a fund needs seed capital.",
  "empty contribution": "Attach some GEN to contribute.",
  "bad name": "The name must be 1 to 80 characters.",
  "bad mandate": "The mandate must be non-empty and at most 4,000 characters.",
  "bad single cap": "The single-name cap must be between 1% and 100%.",
  "bad trade cap": "The per-trade cap must be at least 0.1% and no higher than the single-name cap.",
  "bad bond": "Bonds must be at least 1 wei.",
  "bad window": "The appeal window must be between 1 minute and 7 days.",
  "bad end": "The fund must end after its appeal window and within 365 days.",
  "unknown fund": "That fund does not exist.",
  "unknown proposal": "That proposal does not exist.",
  "fund closed": "This fund no longer accepts new money or proposals: an approval needs its whole appeal window before the fund ends.",
  "bond mismatch": "Attach exactly the bond this fund requires.",
  "bad target": "The target name must be lowercase letters, digits, spaces, '.', '&' or '-' (1 to 60 characters).",
  "bad thesis": "The thesis must be non-empty and at most 1,200 characters.",
  "bad evidence": "Give one to three distinct evidence URLs, each with its own fingerprint.",
  "bad url": "That is not an acceptable public https URL (no credentials, ports, IP addresses or local hosts).",
  "bad hash": "Each evidence fingerprint must be 64 lowercase hex characters.",
  "bad payee": "The payee must be a 0x address of 40 hex characters.",
  "proposer cannot be payee": "You cannot propose a payment to yourself.",
  "proposal limit": "This fund has reached its maximum number of proposals.",
  "too many open": "You already have the maximum number of open proposals in this fund.",
  "payee mismatch": "That target already has a payee in this fund; a name can only ever pay one address.",
  "bad amount": "The amount must be greater than zero.",
  "trade too large": "That is larger than the per-trade cap allows.",
  "concentration cap": "That would put more than the single-name cap into this target (counting proposals still open).",
  "insufficient idle balance": "The fund's idle balance, after what open proposals already earmark, cannot cover this.",
  "not pending": "This proposal already has a verdict.",
  "proposal expired": "This proposal has been open too long to be judged. Expire it to release its funds.",
  "retry too soon": "An evidence page could not be loaded last time. Retries are spaced apart; try again after the wait shown.",
  "bad judgment": "The jury returned something unusable. Nothing moved. Try resolving again.",
  "not appealable": "Only an approved allocation that has not been appealed can be appealed.",
  "window closed": "The appeal window for this allocation has closed.",
  "already appealed": "This allocation has already been appealed once.",
  "members only": "Only members of this fund (anyone who contributed) can appeal.",
  "not appealed": "There is no appeal waiting on this proposal.",
  "not approved": "This proposal is not approved and ready to execute.",
  "window open": "The appeal window is still open; the allocation can execute when it closes.",
  "not open": "This proposal is already settled.",
  "not expired yet": "A proposal can only be expired after its waiting window has passed.",
  "fund still open": "Members can redeem only after the fund ends.",
  "proposals still open": "Redemption opens once every proposal has settled or expired.",
  "nothing to redeem": "You have no stake left to redeem in this fund.",
  "nothing to recover": "No failed payment is waiting for this address.",
  "bad recipient": "That is not a valid address.",
  "bad keeper fee": "The keeper fee can be at most 1% of the seed capital.",
  "bad watch": "Give up to three distinct watch pages.",
  "target frozen": "The standing watch has frozen this target: its sources document adverse news. A later scan must clear it first.",
  "no watch sources": "This fund has no watch pages to scan.",
  "nothing to watch": "There are no held or pending targets to scan yet.",
  "scan too soon": "Scans are spaced apart; try again after the gap shown.",
};

/** Refusals that depend on the clock; a dry run may see a stale time, so they never block a send. */
export const TIME_DEPENDENT = new Set(["fund closed", "window closed", "retry too soon", "not expired yet", "proposal expired", "window open", "fund still open", "scan too soon"]);

export function describeError(e: unknown): string {
  const cause = (e as { cause?: { data?: { receipt?: { result?: unknown } } } })?.cause;
  const decoded = decodeRevert(cause?.data?.receipt?.result);
  if (decoded) return REFUSALS[decoded] ?? decoded;
  const msg = e instanceof Error ? e.message : String(e);
  if (/user rejected|denied|4001/i.test(msg)) return "You declined the request in your wallet.";
  return msg.length > 300 ? msg.slice(0, 300) + "…" : msg;
}

/** The raw refusal key (e.g. "bad url") behind an error, if the contract produced one. */
export function refusalKey(e: unknown): string | undefined {
  const cause = (e as { cause?: { data?: { receipt?: { result?: unknown } } } })?.cause;
  return decodeRevert(cause?.data?.receipt?.result);
}
