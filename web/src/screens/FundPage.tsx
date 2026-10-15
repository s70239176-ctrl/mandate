import { useState } from "react";
import { getFund, getRedeemable, getStake, listProposals, sendTx } from "../lib/chain.ts";
import { useLoad, useNow, useTx } from "../hooks.ts";
import { formatDate, formatGen, hostOf, parseGen, shortAddr, timeLeft } from "../lib/format.ts";
import { bps, statusInfo, windowText } from "../lib/view.ts";
import { useSession } from "../wallet-context.ts";
import { Copy, Empty, ErrorBox, Pill, Skeleton, Stat, TxStatus } from "../components/Ui.tsx";

export function FundPage({ id }: { id: number }) {
  const { me, requireSigner, useDemoAccount } = useSession();
  const now = useNow();
  const fund = useLoad(() => getFund(id), [id]);
  const props = useLoad(() => listProposals(id, "", 0, 20), [id]);
  const mine = useLoad(async () => (me ? { stake: await getStake(id, me), redeemable: await getRedeemable(id, me) } : null), [id, me]);
  const contribute = useTx();
  const redeem = useTx();
  const [amount, setAmount] = useState("1");

  if (fund.loading && !fund.data) return <Skeleton rows={6} />;
  if (fund.error || !fund.data) return <ErrorBox message={fund.error ?? "Fund not found."} onRetry={fund.reload} />;
  const f = fund.data;
  const refresh = () => (fund.reload(), props.reload(), mine.reload());

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

  const share = (a: bigint) => (f.maxSingle > 0n ? Math.min(100, Number((a * 10000n) / f.maxSingle) / 100) : 0);
  const closed = !f.open;

  return (
    <>
      <div className="crumb">
        <a href="#/">Funds</a> / Fund {f.id}
      </div>
      <div className="row between">
        <h1>{f.name}</h1>
        {f.open && (
          <a href={`#/f/${f.id}/propose`}>
            <button>Propose an allocation</button>
          </a>
        )}
      </div>
      <p className="lede">
        {bps(f.maxSingleBps)} of stake in any one name · {bps(f.maxTradeBps)} per trade · {windowText(f.appealWindow)} to appeal · {closed ? "ended " + formatDate(f.endsAt) : timeLeft(f.endsAt, now) + " (ends " + formatDate(f.endsAt) + ")"}
      </p>

      <div className="mandate-box">
        <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
          Frozen mandate
        </div>
        <div className="pre">{f.mandate}</div>
      </div>

      <div className="stat-grid">
        <Stat k="Idle (free)" v={`${formatGen(f.free)} GEN`} s={`${formatGen(f.pool)} in the pool`} />
        <Stat k="Earmarked" v={`${formatGen(f.reserved)} GEN`} s="by open proposals" />
        <Stat k="Allocated" v={`${formatGen(f.allocated)} GEN`} s="paid to payees" />
        <Stat k="Members" v={f.members} s={`${formatGen(f.totalStake)} GEN staked`} />
        <Stat k="Max per name" v={`${formatGen(f.maxSingle)} GEN`} s={`per trade ≤ ${formatGen(f.maxTrade)}`} />
      </div>

      <h2>Positions</h2>
      {f.positions.length === 0 ? (
        <Empty>Nothing proposed yet.</Empty>
      ) : (
        <div className="tbl">
          <table>
            <thead>
              <tr>
                <th>Target</th>
                <th className="hide-sm">Payee</th>
                <th className="num">Allocated</th>
                <th className="num hide-sm">Earmarked</th>
                <th style={{ width: "28%" }}>Of the single-name cap</th>
              </tr>
            </thead>
            <tbody>
              {f.positions.map((p) => (
                <tr key={p.target}>
                  <td>{p.target}</td>
                  <td className="hide-sm">
                    <Copy text={p.payee} />
                  </td>
                  <td className="num">{formatGen(p.allocated)}</td>
                  <td className="num hide-sm">{formatGen(p.reserved)}</td>
                  <td>
                    <div className="bar" title={`${share(p.allocated + p.reserved).toFixed(0)}% of the cap`}>
                      <i className="res" style={{ width: `${share(p.allocated + p.reserved)}%` }} />
                      <i style={{ width: `${share(p.allocated)}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Proposals</h2>
      {props.loading && !props.data && <Skeleton rows={3} />}
      {props.error && <ErrorBox message={props.error} onRetry={props.reload} />}
      {props.data && props.data.items.length === 0 && <Empty>No proposals yet.</Empty>}
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
                const s = statusInfo(p);
                return (
                  <tr key={p.id} className="hover" onClick={() => (window.location.hash = `#/p/${p.id}`)}>
                    <td>
                      <a href={`#/p/${p.id}`}>{p.id}</a>
                    </td>
                    <td>
                      {p.target}
                      <div className="sub">{hostOf(p.urls[0], 40)}</div>
                    </td>
                    <td className="num">{formatGen(p.amount)}</td>
                    <td>
                      <Pill label={s.label} tone={s.tone} />
                    </td>
                    <td className="hide-sm mono muted">{shortAddr(p.proposer)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="cols">
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Join or add capital</h2>
          <p className="muted">
            Contributing makes you a member: you can appeal an approved allocation, and after the fund ends you redeem a pro-rata share of what was never
            allocated. Allocated GEN is spent. Members share any loss pro rata.
          </p>
          {mine.data && <p>Your stake: <b className="mono">{formatGen(mine.data.stake)} GEN</b></p>}
          <label htmlFor="amt">Amount (GEN)</label>
          <input id="amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={!f.open} />
          <div className="actions">
            <button disabled={!f.open || contribute.busy || !parseGen(amount)} onClick={add}>
              Contribute
            </button>
          </div>
          <TxStatus state={contribute.state} doneText="Contributed." />
        </div>
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Redeem</h2>
          <p className="muted">
            Opens when the fund has ended and every proposal has settled or expired. Your share is your stake over all unredeemed stake, applied to the idle
            balance.
          </p>
          {mine.data && closed && (
            <p>
              Redeemable now: <b className="mono">{formatGen(mine.data.redeemable)} GEN</b>
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
