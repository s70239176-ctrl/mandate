import { useState } from "react";
import { getFund, sendTx } from "../lib/chain.ts";
import { fingerprintUrl, isHash } from "../lib/fingerprint.ts";
import { useLoad, useTx } from "../hooks.ts";
import { formatGen, parseGen } from "../lib/format.ts";
import { useSession } from "../wallet-context.ts";
import { Confirm, ErrorBox, Skeleton, TxStatus } from "../components/Ui.tsx";

interface Ev {
  url: string;
  hash: string;
  note: string;
}

export function ProposePage({ id }: { id: number }) {
  const { requireSigner, useDemoAccount } = useSession();
  const fund = useLoad(() => getFund(id), [id]);
  const tx = useTx();
  const [target, setTarget] = useState("");
  const [payee, setPayee] = useState("");
  const [amount, setAmount] = useState("");
  const [thesis, setThesis] = useState("");
  const [evidence, setEvidence] = useState<Ev[]>([{ url: "", hash: "", note: "" }]);
  const [confirming, setConfirming] = useState(false);

  if (fund.loading && !fund.data) return <Skeleton rows={5} />;
  if (fund.error || !fund.data) return <ErrorBox message={fund.error ?? "Fund not found."} onRetry={fund.reload} />;
  const f = fund.data;

  const wei = parseGen(amount);
  const position = f.positions.find((p) => p.target === target.trim());
  const used = position ? position.allocated + position.reserved : 0n;
  const room = f.maxSingle > used ? f.maxSingle - used : 0n;
  const limit = [f.maxTrade, room, f.free].reduce((a, b) => (a < b ? a : b));

  const problems: string[] = [];
  if (!/^[a-z0-9]([a-z0-9 .&-]{0,58}[a-z0-9])?$/.test(target.trim())) problems.push("Name the target in lowercase letters, digits, spaces, '.', '&' or '-'.");
  if (!/^0x[0-9a-fA-F]{40}$/.test(payee.trim())) problems.push("The payee must be a 0x address.");
  else if (position && position.payee.toLowerCase() !== payee.trim().toLowerCase()) problems.push(`This target already pays ${position.payee}; a name can only pay one address.`);
  if (!wei || wei < 1n) problems.push("Enter an amount of GEN.");
  else if (wei > limit) problems.push(`The most you can propose for this target right now is ${formatGen(limit)} GEN.`);
  if (!thesis.trim() || thesis.length > 1200) problems.push("Write a short thesis (up to 1,200 characters).");
  evidence.forEach((e, i) => {
    if (!/^https:\/\//.test(e.url)) problems.push(`Evidence ${i + 1}: enter a public https URL.`);
    else if (!isHash(e.hash)) problems.push(`Evidence ${i + 1}: add its fingerprint.`);
  });
  if (new Set(evidence.map((e) => e.url)).size !== evidence.length) problems.push("Evidence URLs must be distinct.");

  const patch = (i: number, p: Partial<Ev>) => setEvidence((cur) => cur.map((e, j) => (j === i ? { ...e, ...p } : e)));

  async function fingerprint(i: number) {
    patch(i, { note: "Fetching…" });
    try {
      const fp = await fingerprintUrl(evidence[i].url);
      patch(i, { hash: fp.hash, note: `${fp.chars} characters committed.` });
    } catch (e) {
      patch(i, { note: e instanceof Error ? e.message : String(e) });
    }
  }

  async function submit() {
    setConfirming(false);
    const signer = requireSigner();
    if (!signer) return useDemoAccount();
    await tx.run((onPhase) =>
      sendTx(signer, "propose", [BigInt(id), target.trim(), payee.trim(), wei!, thesis.trim(), evidence.map((e) => e.url), evidence.map((e) => e.hash)], f.bond, onPhase),
    );
  }

  return (
    <>
      <div className="crumb">
        <a href="#/">Funds</a> / <a href={`#/f/${id}`}>{f.name}</a> / Propose
      </div>
      <h1>Propose an allocation</h1>
      <p className="lede">
        Point to public evidence that the target fits the mandate. You commit to each page by fingerprint, so the jury judges exactly what you cited. If it
        is approved it waits out the appeal window and then anyone can execute it.
      </p>
      <div className="card" style={{ marginTop: 24 }}>
        <div className="fields">
          <div>
            <label htmlFor="target">Target name</label>
            <input id="target" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="sunfield solar" />
          </div>
          <div>
            <label htmlFor="amount">Amount (GEN)</label>
            <input id="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <div className="hint">Up to {formatGen(limit)} GEN right now (trade cap, single-name room and idle balance).</div>
          </div>
        </div>
        <label htmlFor="payee">Payee address</label>
        <input id="payee" className="mono" value={payee} onChange={(e) => setPayee(e.target.value)} placeholder="0x…" />
        <div className="hint">Where the GEN goes if this executes. It is fixed for this target name forever, and cannot be your own address.</div>
        <label htmlFor="thesis">Thesis</label>
        <textarea id="thesis" value={thesis} onChange={(e) => setThesis(e.target.value)} rows={4} />

        <h2 style={{ margin: "28px 0 4px" }}>Evidence ({evidence.length} of 3)</h2>
        {evidence.map((e, i) => (
          <div key={i} className="card" style={{ marginTop: 12 }}>
            <label htmlFor={`u${i}`} style={{ marginTop: 0 }}>
              Public page {i + 1}
            </label>
            <input id={`u${i}`} value={e.url} onChange={(ev) => patch(i, { url: ev.target.value.trim(), hash: "" })} placeholder="https://…" />
            <label htmlFor={`h${i}`}>Fingerprint (sha256 of the cleaned page text)</label>
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <input id={`h${i}`} className="mono" value={e.hash} onChange={(ev) => patch(i, { hash: ev.target.value.trim() })} placeholder="64 hex characters" />
              <button className="ghost" disabled={!/^https:\/\//.test(e.url)} onClick={() => fingerprint(i)}>
                Compute
              </button>
            </div>
            <div className="hint">
              {e.note || (
                <>
                  If this browser cannot read the page, run <span className="mono">npm run fingerprint -- &lt;url&gt;</span> and paste the result.
                </>
              )}
            </div>
            {evidence.length > 1 && (
              <div className="actions" style={{ marginTop: 8 }}>
                <button className="ghost small" onClick={() => setEvidence((cur) => cur.filter((_, j) => j !== i))}>
                  Remove
                </button>
              </div>
            )}
          </div>
        ))}
        {evidence.length < 3 && (
          <button className="ghost small" onClick={() => setEvidence((cur) => [...cur, { url: "", hash: "", note: "" }])}>
            Add another page
          </button>
        )}

        {problems.length > 0 && (target || payee || amount || thesis) && (
          <div className="hint err" style={{ marginTop: 14 }}>
            {problems[0]}
          </div>
        )}
        <div className="actions">
          <button disabled={problems.length > 0 || tx.busy || !f.open} onClick={() => setConfirming(true)}>
            Propose with {formatGen(f.bond)} GEN bond
          </button>
        </div>
        <TxStatus state={tx.state} doneText="Proposed." />
        {tx.state.kind === "done" && !tx.state.outcome.error && (
          <p>
            <a href={`#/f/${id}`}>Back to the fund</a> to find it and ask the jury to read the evidence.
          </p>
        )}
      </div>
      <Confirm open={confirming} title="Send this proposal?" confirmLabel="Propose" onConfirm={submit} onCancel={() => setConfirming(false)}>
        You are posting a bond of <b className="mono">{formatGen(f.bond)} GEN</b>. It comes back when the allocation executes, or if the jury rejects it for an
        adverse event or unreachable evidence. It goes to the treasury if the jury finds the target out of mandate, the evidence changes after you commit, or an
        appeal against it is upheld.
      </Confirm>
    </>
  );
}
