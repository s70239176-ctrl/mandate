import { useEffect, useState } from "react";
import { ExternalLink, Gavel, Scale, ShieldCheck } from "lucide-react";
import { EXPLORER, CONTRACT, getFund, getProposal, getStake, readJury, recallTx, rememberTx, sendTx } from "../lib/chain.ts";
import { fingerprintUrl, isHash } from "../lib/fingerprint.ts";
import { useLoad, useNow, useTx } from "../hooks.ts";
import { formatDate, formatGen, shortAddr } from "../lib/format.ts";
import { noteText, stages, statusInfo } from "../lib/view.ts";
import { useSession } from "../wallet-context.ts";
import { CheckRow, Confirm, Copy, ErrorBox, KV, Pill, Section, Skeleton, Stepper, TxStatus } from "../components/Ui.tsx";

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
  const resolveHash = recallTx("resolve", id);
  const jury = useLoad(() => (resolveHash ? readJury(resolveHash) : Promise.resolve(null)), [id, resolveHash, prop.data?.status]);

  // The chain state is readable as soon as the validators accept a transaction, long before it finalizes.
  const phase = act.state.kind === "running" ? act.state.phase : "";
  useEffect(() => {
    if (phase !== "accepted") return;
    prop.reload();
    fund.reload();
    jury.reload();
    const t = setInterval(() => (prop.reload(), jury.reload()), 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (prop.loading && !prop.data) return <Skeleton rows={8} />;
  if (prop.error || !prop.data) return <ErrorBox message={prop.error ?? "Proposal not found."} onRetry={prop.reload} />;
  const p = prop.data;
  const f = fund.data;
  const s = statusInfo(p, now);
  const refresh = () => (prop.reload(), fund.reload(), stake.reload(), jury.reload());

  async function call(fn: string, args: unknown[], value = 0n, kind?: string) {
    const signer = requireSigner();
    if (!signer) return useDemoAccount();
    const out = await act.run((onPhase) => sendTx(signer, fn, args, value, onPhase, kind ? (h) => rememberTx(kind, id, h) : undefined));
    if (out) refresh();
  }

  const inWindow = p.status === "APPROVED" && now < p.executableAt;
  const canExecute = p.status === "APPROVED" && now >= p.executableAt && now < p.expiresAt;
  const canExpire = ["PENDING", "APPROVED", "APPEALED"].includes(p.status) && now >= p.expiresAt;
  const isMember = (stake.data ?? 0n) > 0n;
  const judging = p.status === "PENDING" || p.status === "APPEALED";
  const hasVerdict = p.inTheme !== null;
  const appealOk = /^https:\/\//.test(appealUrl) && isHash(appealHash) && !p.urls.includes(appealUrl);
  const frozen = !!f && f.frozen.includes(p.target);
  const pos = f?.positions.find((x) => x.target === p.target);
  const open = ["PENDING", "APPROVED", "APPEALED"].includes(p.status);

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

  const agree = jury.data?.votes.filter((v) => v.vote.toLowerCase() === "agree").length ?? 0;

  return (
    <>
      <div className="crumb">
        <a href="#/">Funds</a> / <a href={`#/f/${p.fundId}`}>{f?.name ?? `Fund ${p.fundId}`}</a> / Proposal {p.id}
      </div>
      <div className="row between" style={{ alignItems: "flex-end" }}>
        <div>
          <div className="eyebrow">Allocation proposal #{p.id}</div>
          <h1 style={{ marginTop: 8 }}>
            {formatGen(p.amount)} GEN to <span className="mint">{p.target}</span>
          </h1>
        </div>
        <Pill label={s.label} tone={s.tone} />
      </div>
      {noteText(p.note) && <p className="muted" style={{ marginTop: 12, maxWidth: "70ch" }}>{noteText(p.note)}</p>}

      <div className="card" style={{ marginTop: 24 }}>
        <Stepper steps={stages(p, now)} />
      </div>

      <div className="cols two section" style={{ marginTop: 28 }}>
        <div className="card">
          <div className="row" style={{ gap: 8, marginBottom: 6 }}>
            <Scale size={17} className="gold" /> <h3>The contract&apos;s checks</h3>
          </div>
          <p className="dim" style={{ fontSize: 13, marginBottom: 6 }}>Deterministic code. No model is asked.</p>
          <CheckRow state="ok" title="Evidence committed" detail="Each page was fingerprinted when filed." value={`${p.urls.length} page${p.urls.length === 1 ? "" : "s"}`} />
          <CheckRow
            state={f ? (p.amount <= f.maxTrade ? "ok" : "no") : "wait"}
            title="Within the per-trade cap"
            value={f ? `${formatGen(p.amount)} / ${formatGen(f.maxTrade)}` : "…"}
          />
          <CheckRow
            state={f && pos ? (pos.allocated + pos.reserved <= f.maxSingle ? "ok" : "no") : "wait"}
            title="Within the single-name cap"
            detail="Executed positions plus open proposals for this name."
            value={f && pos ? `${formatGen(pos.allocated + pos.reserved)} / ${formatGen(f.maxSingle)}` : "…"}
          />
          <CheckRow state="ok" title="Payee fixed for this name" detail="One name pays one address, forever." value={shortAddr(p.payee)} />
          <CheckRow state={frozen ? "no" : "ok"} title="Not frozen by the standing watch" value={frozen ? "frozen" : "clear"} />
        </div>

        <div className="card">
          <div className="row" style={{ gap: 8, marginBottom: 6 }}>
            <Gavel size={17} className="mint" /> <h3>The jury&apos;s answer</h3>
          </div>
          <p className="dim" style={{ fontSize: 13, marginBottom: 6 }}>Validators fetched the pages and judged them against the frozen mandate.</p>
          <CheckRow
            state={p.evidenceState === "ok" ? "ok" : p.evidenceState === "changed" || p.evidenceState === "withdrawn" ? "no" : "wait"}
            title="Pages matched their fingerprints"
            value={p.evidenceState === "ok" ? "yes" : p.evidenceState === "changed" ? "changed" : p.evidenceState === "withdrawn" ? "unreachable" : "—"}
          />
          <CheckRow state={!hasVerdict ? "wait" : p.inTheme ? "ok" : "no"} title="In theme" detail="The target's actual business fits the mandate." value={hasVerdict ? String(p.inTheme) : "—"} />
          <CheckRow state={!hasVerdict ? "wait" : p.excluded ? "no" : "ok"} title="Nothing excluded is documented" value={hasVerdict ? (p.excluded ? "excluded" : "none") : "—"} />
          <CheckRow state={!hasVerdict ? "wait" : p.adverse ? "no" : "ok"} title="No material adverse development" value={hasVerdict ? (p.adverse ? "adverse" : "none") : "—"} />
          {jury.data && jury.data.votes.length > 0 && (
            <>
              <div className="jury" aria-label="Validator votes">
                {jury.data.votes.map((v) => (
                  <span key={v.validator} className={`juror ${v.vote.toLowerCase()}`} title={`${v.validator}: ${v.vote}`}>
                    {v.validator.slice(2, 5)}
                  </span>
                ))}
              </div>
              <div className="dim" style={{ fontSize: 12.5 }}>
                {agree} of {jury.data.votes.length} validators agreed with the leader · consensus {jury.data.status.toLowerCase()}
              </div>
            </>
          )}
        </div>
      </div>

      <Section title="The case">
        <div className="card">
          <div className="cols">
            <KV k="Proposer">
              <Copy text={p.proposer} />
            </KV>
            <KV k="Payee">
              <Copy text={p.payee} />
            </KV>
            <KV k="Bond">
              <span className="num">
                {formatGen(p.bond)} GEN · {p.bondOutcome.toLowerCase()}
              </span>
            </KV>
            <KV k="Proposed">{formatDate(p.createdAt)}</KV>
            {p.executableAt > 0 && <KV k="Executable after">{formatDate(p.executableAt)}</KV>}
            <KV k="Expires">{formatDate(p.expiresAt)}</KV>
          </div>
          <h2 style={{ margin: "22px 0 8px" }}>Thesis</h2>
          <p className="pre">{p.thesis}</p>
          <h2 style={{ margin: "22px 0 10px" }}>Evidence the jury read</h2>
          <div className="stack">
            {p.urls.map((u, i) => (
              <a key={u} className="evidence" href={u} target="_blank" rel="noreferrer noopener">
                <div className="u">
                  {u} <ExternalLink size={12} style={{ verticalAlign: -1 }} />
                </div>
                <div className="h">sha256 {p.hashes[i]}</div>
              </a>
            ))}
          </div>
        </div>
      </Section>

      {p.appealState && (
        <Section title="Appeal">
          <div className="card">
            <div className="cols">
              <KV k="Filed by">
                <Copy text={p.appellant} />
              </KV>
              <KV k="Outcome">
                <b>{p.appealState.toLowerCase()}</b> · bond <span className="num">{formatGen(p.appealBond)} GEN</span>
              </KV>
            </div>
            <a className="evidence" style={{ marginTop: 14 }} href={p.appealUrl} target="_blank" rel="noreferrer noopener">
              <div className="u">{p.appealUrl}</div>
              <div className="h">sha256 {p.appealHash}</div>
            </a>
          </div>
        </Section>
      )}

      <Section title="Actions">
        <div className="card">
          <div className="actions" style={{ marginTop: 0 }}>
            {p.status === "PENDING" && (
              <button disabled={act.busy} onClick={() => call("resolve_proposal", [BigInt(p.id)], 0n, "resolve")}>
                <Gavel size={16} /> Ask the jury
              </button>
            )}
            {p.status === "APPEALED" && (
              <button disabled={act.busy} onClick={() => call("resolve_appeal", [BigInt(p.id)], 0n, "appeal")}>
                <Gavel size={16} /> Ask the jury about the appeal
              </button>
            )}
            {canExecute && (
              <button disabled={act.busy} onClick={() => call("execute", [BigInt(p.id)])}>
                <ShieldCheck size={16} /> Execute allocation
              </button>
            )}
            {canExpire && (
              <button className="ghost" disabled={act.busy} onClick={() => call("expire_proposal", [BigInt(p.id)])}>
                Expire and release funds
              </button>
            )}
            {inWindow && <span className="muted">Waiting out the appeal window. Anyone can execute after {formatDate(p.executableAt)}.</span>}
            {!open && <span className="muted">Nothing left to do on this proposal.</span>}
            {open && !judging && !canExecute && !canExpire && !inWindow && <span className="muted">Nothing to do right now.</span>}
          </div>
          {frozen && open && <p className="hint err">This target is frozen by the standing watch, so it cannot execute until a later scan clears it.</p>}
          <TxStatus state={act.state} judging={judging} doneText="Done." />
        </div>
      </Section>

      {inWindow && f && (
        <Section title="Appeal this trade">
          <div className="card">
            <p className="muted" style={{ maxWidth: "70ch" }}>
              Members can appeal an approved allocation once, inside its window, by pointing to a public page that documents a violation of the mandate or a
              material adverse fact about this target. Opinion is not evidence. A bond of <b className="num">{formatGen(f.appealBond)} GEN</b> is returned if the
              appeal is upheld or the page disappears, and kept by the treasury if the jury is not persuaded.
            </p>
            {!me ? (
              <div className="actions">
                <button onClick={useDemoAccount}>Use demo account to appeal</button>
              </div>
            ) : !isMember ? (
              <p className="hint err" style={{ marginTop: 12 }}>
                Only members of this fund can appeal. Contribute to the fund first.
              </p>
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
            You are posting <b className="num">{formatGen(f.appealBond)} GEN</b>. It freezes this allocation until a jury reads your page against the mandate.
          </Confirm>
        </Section>
      )}

      <p className="dim" style={{ marginTop: 28, fontSize: 13 }}>
        Contract{" "}
        <a href={`${EXPLORER}/address/${CONTRACT}`} target="_blank" rel="noreferrer noopener">
          {shortAddr(CONTRACT)}
        </a>
      </p>
    </>
  );
}
