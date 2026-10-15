import { useState } from "react";
import { EXPLORER, CONTRACT, getFund, getProposal, getStake, sendTx } from "../lib/chain.ts";
import { fingerprintUrl, isHash } from "../lib/fingerprint.ts";
import { useLoad, useNow, useTx } from "../hooks.ts";
import { formatDate, formatGen, shortAddr } from "../lib/format.ts";
import { noteText, statusInfo, timeline } from "../lib/view.ts";
import { useSession } from "../wallet-context.ts";
import { Copy, Confirm, ErrorBox, KV, Pill, Skeleton, TxStatus } from "../components/Ui.tsx";

function V({ k, v, good }: { k: string; v: boolean | null; good: "t" | "f" }) {
  const cls = v === null ? "n" : (v ? "t" : "f") === good ? "t" : "f";
  return (
    <div>
      <div className="k">{k}</div>
      <div className={`v ${cls}`}>{v === null ? "—" : String(v)}</div>
    </div>
  );
}

export function ProposalPage({ id }: { id: number }) {
  const { me, requireSigner, useDemoAccount } = useSession();
  const now = useNow(15000);
  const prop = useLoad(() => getProposal(id), [id]);
  const fund = useLoad(async () => getFund((await getProposal(id)).fundId), [id]);
  const stake = useLoad(async () => (me ? getStake((await getProposal(id)).fundId, me) : 0n), [id, me]);
  const act = useTx();
  const [appealUrl, setAppealUrl] = useState("");
  const [appealHash, setAppealHash] = useState("");
  const [appealNote, setAppealNote] = useState("");
  const [confirming, setConfirming] = useState(false);

  if (prop.loading && !prop.data) return <Skeleton rows={6} />;
  if (prop.error || !prop.data) return <ErrorBox message={prop.error ?? "Proposal not found."} onRetry={prop.reload} />;
  const p = prop.data;
  const f = fund.data;
  const s = statusInfo(p);
  const refresh = () => (prop.reload(), fund.reload(), stake.reload());

  async function call(fn: string, args: unknown[], value = 0n) {
    const signer = requireSigner();
    if (!signer) return useDemoAccount();
    const out = await act.run((onPhase) => sendTx(signer, fn, args, value, onPhase));
    if (out) refresh();
  }

  const inWindow = p.status === "APPROVED" && now < p.executableAt;
  const canExecute = p.status === "APPROVED" && now >= p.executableAt && now < p.expiresAt;
  const canExpire = ["PENDING", "APPROVED", "APPEALED"].includes(p.status) && now >= p.expiresAt;
  const isMember = (stake.data ?? 0n) > 0n;
  const judging = p.status === "PENDING" || p.status === "APPEALED";
  const hasVerdict = p.inTheme !== null;
  const appealOk = /^https:\/\//.test(appealUrl) && isHash(appealHash) && !p.urls.includes(appealUrl);

  async function fingerprint() {
    setAppealNote("Fetching…");
    try {
      const fp = await fingerprintUrl(appealUrl);
      setAppealHash(fp.hash);
      setAppealNote(`${fp.chars} characters committed.`);
    } catch (e) {
      setAppealNote(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <>
      <div className="crumb">
        <a href="#/">Funds</a> / <a href={`#/f/${p.fundId}`}>{f?.name ?? `Fund ${p.fundId}`}</a> / Proposal {p.id}
      </div>
      <div className="row between">
        <h1>
          {formatGen(p.amount)} GEN to {p.target}
        </h1>
        <Pill label={s.label} tone={s.tone} />
      </div>
      {noteText(p.note) && <p className="lede">{noteText(p.note)}</p>}

      <div className="panel">
        <div className="cols">
          <KV k="Proposer">
            <Copy text={p.proposer} />
          </KV>
          <KV k="Payee">
            <Copy text={p.payee} />
          </KV>
          <KV k="Bond">
            {formatGen(p.bond)} GEN · {p.bondOutcome.toLowerCase()}
          </KV>
          <KV k="Proposed">{formatDate(p.createdAt)}</KV>
          {p.executableAt > 0 && <KV k="Executable after">{formatDate(p.executableAt)}</KV>}
          <KV k="Expires">{formatDate(p.expiresAt)}</KV>
        </div>
        <h2>Thesis</h2>
        <div className="pre">{p.thesis}</div>
        <h2>Evidence committed</h2>
        {p.urls.map((u, i) => (
          <p key={u} style={{ margin: "4px 0" }}>
            <a href={u} target="_blank" rel="noreferrer noopener">
              {u}
            </a>
            <br />
            <span className="mono dim" style={{ fontSize: 12 }}>
              sha256 {p.hashes[i]}
            </span>
          </p>
        ))}
      </div>

      <h2>The jury&apos;s answer</h2>
      {hasVerdict ? (
        <div className="verdict">
          <V k="in_theme" v={p.inTheme} good="t" />
          <V k="excluded" v={p.excluded} good="f" />
          <V k="adverse" v={p.adverse} good="f" />
        </div>
      ) : (
        <p className="muted">
          {p.evidenceState === "changed"
            ? "Not asked: an evidence page no longer matched its fingerprint."
            : p.evidenceState === "withdrawn"
              ? "Not asked: an evidence page could not be loaded on every attempt."
              : p.status === "PENDING"
                ? `No verdict yet.${p.attempts ? ` The evidence could not be loaded ${p.attempts} time(s); retries are spaced apart.` : ""}`
                : "No verdict was recorded."}
        </p>
      )}
      {p.appealState && (
        <>
          <h2>Appeal</h2>
          <div className="panel">
            <KV k="By">
              <Copy text={p.appellant} />
            </KV>
            <p style={{ margin: "8px 0 0" }}>
              <a href={p.appealUrl} target="_blank" rel="noreferrer noopener">
                {p.appealUrl}
              </a>
            </p>
            <p className="muted" style={{ margin: "6px 0 0" }}>
              Outcome: <b>{p.appealState.toLowerCase()}</b> · bond {formatGen(p.appealBond)} GEN
            </p>
          </div>
        </>
      )}

      <h2>Where it stands</h2>
      <ol className="timeline">
        {timeline(p, now).map((step) => (
          <li key={step.title} className={step.state}>
            <div className="t">{step.title}</div>
            <div className="d">{step.detail}</div>
          </li>
        ))}
      </ol>

      <h2>Actions</h2>
      <div className="panel">
        <div className="actions" style={{ marginTop: 0 }}>
          {p.status === "PENDING" && (
            <button disabled={act.busy} onClick={() => call("resolve_proposal", [BigInt(p.id)])}>
              Ask the jury
            </button>
          )}
          {p.status === "APPEALED" && (
            <button disabled={act.busy} onClick={() => call("resolve_appeal", [BigInt(p.id)])}>
              Ask the jury about the appeal
            </button>
          )}
          {canExecute && (
            <button disabled={act.busy} onClick={() => call("execute", [BigInt(p.id)])}>
              Execute allocation
            </button>
          )}
          {canExpire && (
            <button className="ghost" disabled={act.busy} onClick={() => call("expire_proposal", [BigInt(p.id)])}>
              Expire and release funds
            </button>
          )}
          {!judging && !canExecute && !canExpire && !inWindow && <span className="muted">Nothing left to do on this proposal.</span>}
          {inWindow && <span className="muted">Waiting out the appeal window. Anyone can execute after {formatDate(p.executableAt)}.</span>}
        </div>
        <TxStatus state={act.state} judging={judging} doneText="Done." />
      </div>

      {inWindow && f && (
        <>
          <h2>Appeal this trade</h2>
          <div className="panel">
            <p className="muted">
              Members can appeal an approved allocation once, inside its window, by pointing to a public page that documents a violation of the mandate or a
              material adverse fact about this target. Opinion is not evidence. A bond of <b className="mono">{formatGen(f.appealBond)} GEN</b> is returned if
              the appeal is upheld or the page disappears, and kept by the treasury if the jury is not persuaded.
            </p>
            {!me ? (
              <button onClick={useDemoAccount}>Use demo account to appeal</button>
            ) : !isMember ? (
              <p className="hint err">Only members of this fund can appeal. Contribute to the fund first.</p>
            ) : (
              <>
                <label htmlFor="au">Public page</label>
                <input id="au" value={appealUrl} onChange={(e) => (setAppealUrl(e.target.value.trim()), setAppealHash(""))} placeholder="https://…" />
                <label htmlFor="ah">Fingerprint</label>
                <div className="row" style={{ flexWrap: "nowrap" }}>
                  <input id="ah" className="mono" value={appealHash} onChange={(e) => setAppealHash(e.target.value.trim())} placeholder="64 hex characters" />
                  <button className="ghost" disabled={!/^https:\/\//.test(appealUrl)} onClick={fingerprint}>
                    Compute
                  </button>
                </div>
                <div className="hint">{appealNote || "It must be a different page from the evidence already weighed."}</div>
                <div className="actions">
                  <button className="danger" disabled={!appealOk || act.busy} onClick={() => setConfirming(true)}>
                    File appeal
                  </button>
                </div>
              </>
            )}
          </div>
          <Confirm
            open={confirming}
            title="File this appeal?"
            confirmLabel="File appeal"
            onConfirm={() => (setConfirming(false), call("appeal", [BigInt(p.id), appealUrl, appealHash], f.appealBond))}
            onCancel={() => setConfirming(false)}
          >
            You are posting <b className="mono">{formatGen(f.appealBond)} GEN</b>. It freezes this allocation until a jury reads your page against the mandate.
          </Confirm>
        </>
      )}

      <p className="dim" style={{ marginTop: 22 }}>
        Contract <a href={`${EXPLORER}/address/${CONTRACT}`} target="_blank" rel="noreferrer noopener">{shortAddr(CONTRACT)}</a>
      </p>
    </>
  );
}
