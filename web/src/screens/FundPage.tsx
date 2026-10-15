import { useState } from "react";
import { Clock, Eye, Lock, Plus, ScanSearch, Users } from "lucide-react";
import { getFund, getRedeemable, getStake, listProposals, rememberTx, sendTx } from "../lib/chain.ts";
import { useLoad, useNow, useTx } from "../hooks.ts";
import { formatDate, formatGen, hostOf, parseGen, shortAddr, timeLeft } from "../lib/format.ts";
import { bps, statusInfo, windowText } from "../lib/view.ts";
import { useSession } from "../wallet-context.ts";
import { Copy, Empty, ErrorBox, Pill, Section, Skeleton, TreasuryBar, TxStatus } from "../components/Ui.tsx";

export function FundPage({ id }: { id: number }) {
  const { me, requireSigner, useDemoAccount } = useSession();
  const now = useNow();
  const fund = useLoad(() => getFund(id), [id]);
  const props = useLoad(() => listProposals(id, "", 0, 20), [id]);
  const mine = useLoad(async () => (me ? { stake: await getStake(id, me), redeemable: await getRedeemable(id, me) } : null), [id, me]);
  const contribute = useTx();
  const redeem = useTx();
  const scan = useTx();
  const [amount, setAmount] = useState("5");

  if (fund.loading && !fund.data) return <Skeleton rows={8} />;
  if (fund.error || !fund.data) return <ErrorBox message={fund.error ?? "Fund not found."} onRetry={fund.reload} />;
  const f = fund.data;
  const refresh = () => (fund.reload(), props.reload(), mine.reload());
  const closed = !f.open;
  const capital = f.allocated + f.reserved + f.free;

  async function add() {
    const signer = requireSigner();
    if (!signer) return useDemoAccount();
    const wei = parseGen(amount);
    if (!wei || wei < 1n) return;
    const out = await contribute.run((onPhase) => sendTx(signer, "contribute", [BigInt(id)], wei, onPhase));
    if (out && !out.error) refresh();
  }
  async function take() {
    const signer = requireSigner();
    if (!signer) return useDemoAccount();
    const out = await redeem.run((onPhase) => sendTx(signer, "redeem", [BigInt(id)], 0n, onPhase));
    if (out && !out.error) refresh();
  }
  async function runScan() {
    const signer = requireSigner();
    if (!signer) return useDemoAccount();
    const out = await scan.run((onPhase) => sendTx(signer, "scan", [BigInt(id)], 0n, onPhase, (h) => rememberTx("scan", id, h)));
    if (out && !out.error) refresh();
  }

  const capShare = (a: bigint) => (f.maxSingle > 0n ? Math.min(100, Number((a * 10000n) / f.maxSingle) / 100) : 0);

  return (
    <>
      <div className="crumb">
        <a href="#/">Funds</a> / {f.name}
      </div>
      <div className="row between" style={{ alignItems: "flex-end" }}>
        <div>
          <h1>{f.name}</h1>
          <div className="row muted" style={{ marginTop: 10, gap: 18, fontSize: 13.5 }}>
            <span className="row" style={{ gap: 6 }}>
              <Users size={15} /> {f.members} member{f.members === 1 ? "" : "s"}
            </span>
            <span className="row" style={{ gap: 6 }}>
              <Clock size={15} /> {closed ? `ended ${formatDate(f.endsAt)}` : `${timeLeft(f.endsAt, now)} · ends ${formatDate(f.endsAt)}`}
            </span>
            <span>
              created by <Copy text={f.creator} />
            </span>
          </div>
        </div>
        {f.open && (
          <a href={`#/f/${f.id}/propose`}>
            <button className="big-cta">
              <Plus size={16} /> Propose an allocation
            </button>
          </a>
        )}
      </div>

      <div className="section charter" style={{ marginTop: 28 }}>
        <div className="seal">
          <Lock size={14} /> Frozen mandate · cannot be changed by anyone
        </div>
        <div className="text">{f.mandate}</div>
        <div className="rules">
          <span className="tag gold">≤ {bps(f.maxSingleBps)} in any one name</span>
          <span className="tag gold">≤ {bps(f.maxTradeBps)} per trade</span>
          <span className="tag">{windowText(f.appealWindow)} appeal window</span>
          <span className="tag">proposal bond {formatGen(f.bond)} GEN</span>
          <span className="tag">appeal bond {formatGen(f.appealBond)} GEN</span>
          {f.keeperFee > 0n && <span className="tag">keeper fee {formatGen(f.keeperFee)} GEN</span>}
        </div>
      </div>

      <Section title="Treasury">
        <div className="card">
          <div className="row between" style={{ alignItems: "flex-end", marginBottom: 18 }}>
            <div className="big">
              {formatGen(capital)}
              <small>GEN under mandate</small>
            </div>
            <div className="dim num" style={{ fontSize: 13 }}>
              max per name {formatGen(f.maxSingle)} · max per trade {formatGen(f.maxTrade)}
            </div>
          </div>
          <TreasuryBar allocated={f.allocated} reserved={f.reserved} free={f.free} />
        </div>
      </Section>

      <Section title="Positions" aside={<span className="dim" style={{ fontSize: 12.5 }}>gold tick = single-name cap</span>}>
        {f.positions.length === 0 ? (
          <Empty title="Nothing proposed yet">Positions appear here as soon as the first allocation is proposed.</Empty>
        ) : (
          <div className="tbl">
            <table>
              <thead>
                <tr>
                  <th>Target</th>
                  <th className="num">Allocated</th>
                  <th className="num hide-sm">Earmarked</th>
                  <th style={{ width: "30%" }}>Of the cap</th>
                </tr>
              </thead>
              <tbody>
                {f.positions.map((p) => (
                  <tr key={p.target}>
                    <td>
                      <div className="row" style={{ gap: 8 }}>
                        <b style={{ fontWeight: 600 }}>{p.target}</b>
                        {f.frozen.includes(p.target) && <Pill label="frozen" tone="frozen" />}
                      </div>
                      <div className="sub">
                        pays <Copy text={p.payee} />
                      </div>
                    </td>
                    <td className="num">{formatGen(p.allocated)}</td>
                    <td className="num hide-sm">{formatGen(p.reserved)}</td>
                    <td>
                      <div className="pos-bar" title={`${capShare(p.allocated + p.reserved).toFixed(0)}% of the cap`}>
                        <i className="res" style={{ width: `${capShare(p.allocated + p.reserved)}%` }} />
                        <i className="alloc" style={{ width: `${capShare(p.allocated)}%` }} />
                      </div>
                      <div className="cap-note">{capShare(p.allocated + p.reserved).toFixed(0)}% used</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Standing watch">
        <div className="card">
          {f.watchUrls.length === 0 ? (
            <p className="muted">This fund froze no watch pages at creation, so it has no standing watch.</p>
          ) : (
            <>
              <div className="row between" style={{ alignItems: "flex-start", gap: 24 }}>
                <div className="grow">
                  <p className="muted" style={{ maxWidth: "62ch" }}>
                    Validators read these frozen pages against what the fund holds. If they document something the mandate excludes, or a material adverse
                    development, the target is <b>frozen</b>: no new proposals and no executions until a later scan clears it. A scan can only block. It never
                    moves money.
                  </p>
                  <div className="stack" style={{ marginTop: 14 }}>
                    {f.watchUrls.map((u) => (
                      <a key={u} className="evidence" href={u} target="_blank" rel="noreferrer noopener">
                        <div className="u">
                          <Eye size={13} style={{ verticalAlign: -2, marginRight: 6 }} />
                          {hostOf(u, 80)}
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
                <div style={{ minWidth: 230 }}>
                  <div className="kv">
                    <span className="k">Last scan</span>
                    <span className="v">{f.scanCount > 0 ? formatDate(f.lastScanAt) : "never"}</span>
                  </div>
                  <div className="kv" style={{ marginTop: 12 }}>
                    <span className="k">Frozen now</span>
                    <span className="v">{f.frozen.length > 0 ? f.frozen.join(", ") : "none"}</span>
                  </div>
                  <div className="actions" style={{ marginTop: 16 }}>
                    <button className="ghost" disabled={scan.busy || f.positions.length === 0} onClick={runScan}>
                      <ScanSearch size={16} /> Run a scan
                    </button>
                  </div>
                </div>
              </div>
              <TxStatus state={scan.state} judging doneText="Scan complete." />
            </>
          )}
        </div>
      </Section>

      <Section title="Proposals" aside={props.data && <span className="dim num">{props.data.total} total</span>}>
        {props.loading && !props.data && <Skeleton rows={3} />}
        {props.error && <ErrorBox message={props.error} onRetry={props.reload} />}
        {props.data && props.data.items.length === 0 && <Empty title="No proposals yet">Be the first to propose an allocation.</Empty>}
        {props.data && props.data.items.length > 0 && (
          <div className="tbl">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Target</th>
                  <th className="num">Amount</th>
                  <th>Status</th>
                  <th className="hide-sm">Proposer</th>
                </tr>
              </thead>
              <tbody>
                {props.data.items.map((p) => {
                  const s = statusInfo(p, now);
                  return (
                    <tr key={p.id} className="link" onClick={() => (window.location.hash = `#/p/${p.id}`)}>
                      <td className="num dim">{p.id}</td>
                      <td>
                        <a href={`#/p/${p.id}`} style={{ fontWeight: 600, color: "var(--text)" }}>
                          {p.target}
                        </a>
                        <div className="sub">{hostOf(p.urls[0], 44)}</div>
                      </td>
                      <td className="num">{formatGen(p.amount)}</td>
                      <td>
                        <Pill label={s.label} tone={s.tone} />
                      </td>
                      <td className="hide-sm num dim">{shortAddr(p.proposer)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div className="cols two section">
        <div className="card">
          <h3>Join or add capital</h3>
          <p className="muted" style={{ margin: "8px 0 14px" }}>
            Contributing makes you a member: you can appeal an approved allocation, and after the fund ends you redeem a pro-rata share of what was never
            allocated. Allocated GEN is spent, and members share any loss pro rata.
          </p>
          {mine.data && (
            <p style={{ marginBottom: 12 }}>
              Your stake <b className="num">{formatGen(mine.data.stake)} GEN</b>
            </p>
          )}
          <label htmlFor="amt">Amount (GEN)</label>
          <input id="amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={!f.open} />
          <div className="actions">
            <button disabled={!f.open || contribute.busy || !parseGen(amount)} onClick={add}>
              Contribute
            </button>
          </div>
          <TxStatus state={contribute.state} doneText="Contributed." />
        </div>
        <div className="card">
          <h3>Redeem</h3>
          <p className="muted" style={{ margin: "8px 0 14px" }}>
            Opens when the fund has ended and every proposal has settled or expired. Your share is your stake over all unredeemed stake, applied to the
            idle balance.
          </p>
          {mine.data && closed && (
            <p style={{ marginBottom: 12 }}>
              Redeemable now <b className="num">{formatGen(mine.data.redeemable)} GEN</b>
            </p>
          )}
          <div className="actions">
            <button className="ghost" disabled={!closed || redeem.busy || !me} onClick={take}>
              Redeem my share
            </button>
          </div>
          <TxStatus state={redeem.state} doneText="Redeemed." />
        </div>
      </div>
    </>
  );
}
