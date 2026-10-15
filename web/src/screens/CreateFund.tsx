import { useState } from "react";
import { chainNow, sendTx } from "../lib/chain.ts";
import { formatGen, parseGen } from "../lib/format.ts";
import { useTx } from "../hooks.ts";
import { useSession } from "../wallet-context.ts";
import { Confirm, TxStatus } from "../components/Ui.tsx";

const EXAMPLE = `Theme: renewable energy generation and storage (solar, wind, hydro, grid batteries).
Exclusions: any project with documented labor-rights violations or fatal safety incidents.
Evidence standard: a named, public source (news report, filing or project update).`;

const WINDOWS: [string, number][] = [
  ["10 minutes (demo)", 600],
  ["1 hour", 3600],
  ["1 day", 86400],
  ["2 days", 172800],
  ["7 days", 604800],
];

export function CreateFund() {
  const { requireSigner, useDemoAccount } = useSession();
  const tx = useTx();
  const [name, setName] = useState("");
  const [mandate, setMandate] = useState(EXAMPLE);
  const [single, setSingle] = useState("20");
  const [trade, setTrade] = useState("10");
  const [seed, setSeed] = useState("10");
  const [bond, setBond] = useState("0.1");
  const [appealBond, setAppealBond] = useState("0.1");
  const [windowS, setWindowS] = useState(172800);
  const [days, setDays] = useState("30");
  const [confirming, setConfirming] = useState(false);

  const seedWei = parseGen(seed);
  const bondWei = parseGen(bond);
  const appealWei = parseGen(appealBond);
  const singleBps = Math.round(Number(single) * 100);
  const tradeBps = Math.round(Number(trade) * 100);
  const dayN = Number(days);
  const problems: string[] = [];
  if (!name.trim() || name.length > 80) problems.push("Give the fund a name (up to 80 characters).");
  if (!mandate.trim() || mandate.length > 4000) problems.push("Write a mandate (up to 4,000 characters).");
  if (!(singleBps >= 100 && singleBps <= 10000)) problems.push("The single-name cap must be between 1% and 100%.");
  if (!(tradeBps >= 10 && tradeBps <= singleBps)) problems.push("The per-trade cap must be at least 0.1% and no more than the single-name cap.");
  if (!seedWei || seedWei < 1n) problems.push("Seed capital must be a positive amount of GEN.");
  if (!bondWei || bondWei < 1n || !appealWei || appealWei < 1n) problems.push("Both bonds must be positive amounts of GEN.");
  if (!(dayN >= 1 && dayN <= 365)) problems.push("The fund must run between 1 and 365 days.");

  async function submit() {
    setConfirming(false);
    const signer = requireSigner();
    if (!signer) return useDemoAccount();
    await tx.run(async (onPhase) => {
      const ends = (await chainNow()) + Math.round(dayN * 86400);
      return sendTx(signer, "create_fund", [name.trim(), mandate, BigInt(singleBps), BigInt(tradeBps), bondWei!, appealWei!, BigInt(windowS), BigInt(ends)], seedWei!, onPhase);
    });
  }

  return (
    <>
      <h1>Create a fund</h1>
      <p className="lede">
        The mandate, the caps, the bonds and the timings are frozen when you create the fund. Your seed becomes your member stake; anyone can add more later.
      </p>
      <div className="panel">
        <label htmlFor="name">Fund name</label>
        <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Green Transition Treasury" maxLength={80} />
        <label htmlFor="mandate">Mandate (plain English)</label>
        <textarea id="mandate" value={mandate} onChange={(e) => setMandate(e.target.value)} rows={7} />
        <div className="hint">The jury reads this text, verbatim, against the evidence for every proposal. Name what is in theme and what is excluded.</div>
        <div className="field-row">
          <div>
            <label htmlFor="single">Max in any single name (%)</label>
            <input id="single" inputMode="decimal" value={single} onChange={(e) => setSingle(e.target.value)} />
          </div>
          <div>
            <label htmlFor="trade">Max per trade (%)</label>
            <input id="trade" inputMode="decimal" value={trade} onChange={(e) => setTrade(e.target.value)} />
          </div>
          <div>
            <label htmlFor="seed">Seed capital (GEN)</label>
            <input id="seed" inputMode="decimal" value={seed} onChange={(e) => setSeed(e.target.value)} />
          </div>
        </div>
        <div className="hint">Caps are shares of total member stake and are enforced by code, not by the jury.</div>
        <div className="field-row">
          <div>
            <label htmlFor="bond">Proposal bond (GEN)</label>
            <input id="bond" inputMode="decimal" value={bond} onChange={(e) => setBond(e.target.value)} />
          </div>
          <div>
            <label htmlFor="abond">Appeal bond (GEN)</label>
            <input id="abond" inputMode="decimal" value={appealBond} onChange={(e) => setAppealBond(e.target.value)} />
          </div>
          <div>
            <label htmlFor="win">Appeal window</label>
            <select id="win" value={windowS} onChange={(e) => setWindowS(Number(e.target.value))}>
              {WINDOWS.map(([label, s]) => (
                <option key={s} value={s}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="days">Runs for (days)</label>
            <input id="days" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
        </div>
        {problems.length > 0 && (
          <div className="hint err" style={{ marginTop: 14 }}>
            {problems[0]}
          </div>
        )}
        <div className="actions">
          <button disabled={problems.length > 0 || tx.busy} onClick={() => setConfirming(true)}>
            Create fund
          </button>
        </div>
        <TxStatus state={tx.state} doneText="Fund created." />
        {tx.state.kind === "done" && !tx.state.outcome.error && (
          <p>
            <a href="#/">See it in the list</a>
          </p>
        )}
      </div>
      <Confirm open={confirming} title="Freeze this mandate?" confirmLabel="Create fund" onConfirm={submit} onCancel={() => setConfirming(false)}>
        You are sending <b className="mono">{seedWei ? formatGen(seedWei) : "?"} GEN</b> as seed capital. The mandate, caps ({single}% per name, {trade}% per trade),
        bonds and timings cannot be changed afterwards, by anyone. After the fund ends ({days} days) members can redeem what was never allocated.
      </Confirm>
    </>
  );
}
