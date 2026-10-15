import { useEffect, useRef, useState, type ReactNode } from "react";
import type { TxState } from "../hooks.ts";
import { shortAddr } from "../lib/format.ts";
import type { Tone } from "../lib/view.ts";

export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="14" fill="#111a18" stroke="#33473f" strokeWidth="2" />
      <path d="M14 46V20l18 16 18-16v26" fill="none" stroke="#5fd0a0" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="32" cy="17" r="4" fill="#e8c46a" />
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
  pending: "Sent. Each validator is fetching the evidence itself and forming its own verdict…",
  accepted: "The validators agreed. Waiting for finalization: GEN moves only when this finalizes.",
} as const;

export function TxStatus({ state, doneText = "Done.", judging = false }: { state: TxState; doneText?: string; judging?: boolean }) {
  if (state.kind === "idle") return null;
  if (state.kind === "running")
    return (
      <div className="tx" role="status">
        {(judging ? JUDGING_TEXT : PHASE_TEXT)[state.phase]} {state.detail && <span className="muted mono">[{state.detail}]</span>}
      </div>
    );
  if (state.kind === "error")
    return (
      <div className="tx err" role="alert">
        {state.message}
      </div>
    );
  const o = state.outcome;
  if (o.error)
    return (
      <div className="tx err" role="alert">
        {o.error} <Copy text={o.hash} label={`tx ${shortAddr(o.hash)}`} />
      </div>
    );
  return (
    <div className="tx ok" role="status">
      {doneText}
      {o.result ? <b> Result: {o.result}.</b> : null} <Copy text={o.hash} label={`tx ${shortAddr(o.hash)}`} />
    </div>
  );
}

export function Pill({ label, tone }: { label: string; tone: Tone }) {
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

export function Stat({ k, v, s }: { k: string; v: ReactNode; s?: ReactNode }) {
  return (
    <div className="stat">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
      {s && <div className="s">{s}</div>}
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
      {message}{" "}
      {onRetry && (
        <button className="ghost small" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

/** Click to copy; shows the short label. */
export function Copy({ text, label }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <span
      className="copy mono"
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
      <h3 style={{ margin: "0 0 8px", fontFamily: "var(--serif)", fontWeight: 400, fontSize: 24 }}>{title}</h3>
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
