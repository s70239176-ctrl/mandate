export type ProposalStatus = "PENDING" | "APPROVED" | "APPEALED" | "EXECUTED" | "REJECTED" | "CANCELLED" | "EXPIRED";
export type BondOutcome = "HELD" | "RETURNED" | "SLASHED";
export type EvidenceState = "" | "unavailable" | "ok" | "changed" | "withdrawn" | "expired";
export type AppealState = "" | "PENDING" | "UPHELD" | "DISMISSED" | "UNAVAILABLE" | "CHANGED" | "EXPIRED";

export interface Position {
  target: string;
  payee: string;
  allocated: bigint;
  reserved: bigint;
}

export interface Fund {
  id: number;
  creator: string;
  name: string;
  mandate: string;
  maxSingleBps: number;
  maxTradeBps: number;
  /** Current absolute caps in GEN-wei, derived by the contract from total stake. */
  maxSingle: bigint;
  maxTrade: bigint;
  bond: bigint;
  appealBond: bigint;
  appealWindow: number;
  endsAt: number;
  createdAt: number;
  totalStake: bigint;
  redeemedStake: bigint;
  pool: bigint;
  reserved: bigint;
  free: bigint;
  allocated: bigint;
  members: number;
  proposalIds: number[];
  proposalCount: number;
  positions: Position[];
  /** Frozen watch pages, set at creation. */
  watchUrls: string[];
  /** Targets the last scan flagged: no new proposals or executions until a scan clears them. */
  frozen: string[];
  lastScanAt: number;
  scanCount: number;
  /** Paid from idle GEN to whoever settles a step; fixed at creation. */
  keeperFee: bigint;
  open: boolean;
}

export interface Proposal {
  id: number;
  fundId: number;
  proposer: string;
  target: string;
  payee: string;
  amount: bigint;
  thesis: string;
  urls: string[];
  hashes: string[];
  bond: bigint;
  status: ProposalStatus;
  inTheme: boolean | null;
  excluded: boolean | null;
  adverse: boolean | null;
  bondOutcome: BondOutcome;
  evidenceState: EvidenceState;
  /** "" | mandate_violation | adverse_event | evidence_changed | evidence_unavailable | appeal_upheld | expired */
  note: string;
  attempts: number;
  lastAttemptAt: number;
  createdAt: number;
  decidedAt: number;
  executableAt: number;
  executedAt: number;
  expiresAt: number;
  appellant: string;
  appealUrl: string;
  appealHash: string;
  appealBond: bigint;
  appealState: AppealState;
  appealAttempts: number;
  appealedAt: number;
  /** Why it ended as it did: off_theme | excluded_<kind> | adverse_<kind> | evidence_changed | last_look_... | "" */
  reason: string;
  excludedKind: string;
  adverseKind: string;
  lastlookState: "" | "clear" | "unavailable" | "flagged";
  lastlookAttempts: number;
}

export interface ProposerRecord {
  address: string;
  approved: number;
  rejected: number;
  executed: number;
  overturned: number;
}

export interface Prompts {
  proposal: string;
  appeal: string;
  lastLook: string;
  scan: string;
  rules: string[];
}

export interface Params {
  retryGap: number;
  maxUnavailable: number;
  proposalExpiry: number;
  scanGap: number;
  maxUrls: number;
}

export interface Page<T> {
  total: number;
  items: T[];
}

export type Phase = "signing" | "pending" | "accepted" | "finalized";

export interface TxOutcome {
  hash: string;
  status: string;
  /** Plain-language reason when the transaction did not settle or the contract refused it. */
  error?: string;
  /** The string a successful call returned (resolve_proposal: "approved", "rejected", "unavailable"...). */
  result?: string;
}
