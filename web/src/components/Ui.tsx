import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Check, CircleDashed, Loader2, X } from "lucide-react";
import type { TxState } from "../hooks.ts";
import { formatGen, shortAddr } from "../lib/format.ts";
import type { Step, Tone } from "../lib/view.ts";

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="15" fill="#0e1815" stroke="#2a413a" strokeWidth="2" />
      <path d="M14 47V21l18 16 18-16v26" fill="none" stroke="#4fd1a1" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="32" cy="16" r="4.2" fill="#e6c36a" />
    </svg>
  );
}

const PHASE_TEXT = {
  signing: "Waiting for the signature…",
  pending: "Sent. Waiting for the validators to process it…",
  accepted: "The validators accepted it. Waiting for finalization: GEN moves only when this finalizes.",
  finalized: "Finalized.",
} as const;

/** Wording for a jury round: every validator fetches the evidence itself and forms its own verdict. */
const JUDGING_TEXT = {
  ...PHASE_TEXT,
  pending: "Sent. Each validator is fetching the pages itself and forming its own verdict…",
  accepted: "The validators agreed. Waiting for finalization: GEN moves only when this finalizes.",
} as const;

export function TxStatus({ state, doneText = "Done.", judging = false }: { state: TxState; doneText?: string; judging?: boolean }) {
  if (state.kind === "idle") return null;
  if (state.kind === "running")
    return (
      <div className="tx" role="status">
        <Loader2 size={18} className="mint" style={{ animation: "spin 1s linear infinite", flex: "none", marginTop: 2 }} />
        <div>
          {(judging ? JUDGING_TEXT : PHASE_TEXT)[state.phase]} {state.detail && <span className="dim num">[{state.detail}]</span>}
        </div>
      </div>
    );
  if (state.kind === "error")
    return (
      <div className="tx err" role="alert">
        <AlertTriangle size={18} className="red" style={{ flex: "none", marginTop: 2 }} />
        <div>{state.message}</div>
      </div>
    );
  const o = state.outcome;
  if (o.error)
    return (
      <div className="tx err" role="alert">
        <AlertTriangle size={18} className="red" style={{ flex: "none", marginTop: 2 }} />
        <div>
          {o.error} <Copy text={o.hash} label={`tx ${shortAddr(o.hash)}`} />
        </div>
      </div>
    );
  return (
    <div className="tx ok" role="status">
      <Check size={18} className="mint" style={{ flex: "none", marginTop: 2 }} />
      <div>
        {doneText}
        {o.result ? <b> Result: {o.result}.</b> : null} <Copy text={o.hash} label={`tx ${shortAddr(o.hash)}`} />
      </div>
    </div>
  );
}

export function Pill({ label, tone }: { label: string; tone: Tone | "frozen" }) {
  return <span className={`pill ${tone}`}>{label}</span>;
}

export function KV({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="kv">
      <span className="k">{k}</span>
      <span className="v">{children}</span>
    </div>
  );
}

export function Tile({ icon, k, v, s }: { icon?: ReactNode; k: string; v: ReactNode; s?: ReactNode }) {
  return (
    <div className="tile">
      <div className="k">
        {icon}
        {k}
      </div>
      <div className="v">{v}</div>
      {s && <div className="s">{s}</div>}
    </div>
  );
}

export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <div className="head">
        <h2>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** One bar for the whole treasury: what has been paid out, what open proposals earmark, and what is idle. */
export function TreasuryBar({ allocated, reserved, free }: { allocated: bigint; reserved: bigint; free: bigint }) {
  const total = allocated + reserved + free;
  const pct = (x: bigint) => (total > 0n ? Number((x * 10000n) / total) / 100 : 0);
  return (
    <>
      <div className="tbar" role="img" aria-label={`Allocated ${formatGen(allocated)}, earmarked ${formatGen(reserved)}, idle ${formatGen(free)} GEN`}>
        <i className="a" style={{ width: `${pct(allocated)}%` }} />
        <i className="r" style={{ width: `${pct(reserved)}%` }} />
        <i className="f" style={{ width: `${pct(free)}%`, flex: 1 }} />
      </div>
      <div className="legend">
        <div>
          <i style={{ background: "var(--mint)" }} /> Allocated <b>{formatGen(allocated)}</b>
        </div>
        <div>
          <i style={{ background: "var(--amber)" }} /> Earmarked <b>{formatGen(reserved)}</b>
        </div>
        <div>
          <i style={{ background: "var(--line-2)" }} /> Idle <b>{formatGen(free)}</b>
        </div>
      </div>
    </>
  );
}

export function Stepper({ steps }: { steps: { title: string; sub: string; state: "done" | "now" | "later" | "bad" }[] }) {
  return (
    <div className="stepper" role="list">
      {steps.map((s) => (
        <div key={s.title} role="listitem" className={`step ${s.state}`}>
          <b>{s.title}</b>
          {s.sub}
        </div>
      ))}
    </div>
  );
}

/** A compliance line: pass, fail or pending, with what was checked and the value that decided it. */
export function CheckRow({ state, title, detail, value }: { state: "ok" | "no" | "wait"; title: string; detail?: string; value?: ReactNode }) {
  const Icon = state === "ok" ? Check : state === "no" ? X : CircleDashed;
  return (
    <div className="check">
      <Icon size={18} className={state} />
      <div>
        <div className="t">{title}</div>
        {detail && <div className="d">{detail}</div>}
      </div>
      {value !== undefined && <div className="val">{value}</div>}
    </div>
  );
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" style={{ width: `${92 - i * 12}%` }} />
      ))}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="tx err" role="alert">
      <AlertTriangle size={18} className="red" style={{ flex: "none", marginTop: 2 }} />
      <div className="grow">{message}</div>
      {onRetry && (
        <button className="ghost small" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Empty({ title, children }: { title?: string; children?: ReactNode }) {
  return (
    <div className="empty">
      {title && <b>{title}</b>}
      {children}
    </div>
  );
}

/** Click to copy; shows the short label. */
export function Copy({ text, label }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <span
      className="copy"
      title={`Copy ${text}`}
      onClick={() => {
        navigator.clipboard?.writeText(text).then(
          () => {
            setDone(true);
            setTimeout(() => setDone(false), 1200);
          },
          () => {},
        );
      }}
    >
      {done ? "copied" : (label ?? shortAddr(text))}
    </span>
  );
}

/** A native modal that states exactly what is about to happen to the user's GEN before it is sent. */
export function Confirm({
  open,
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="confirm" onCancel={(e) => (e.preventDefault(), onCancel())}>
      <h3 style={{ marginBottom: 10 }}>{title}</h3>
      <div className="muted">{children}</div>
      <div className="actions">
        <button onClick={onConfirm}>{confirmLabel}</button>
        <button className="ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </dialog>
  );
}

export type { Step };
