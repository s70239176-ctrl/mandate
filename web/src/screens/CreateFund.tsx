import { useState } from "react";
import { chainNow, sendTx } from "../lib/chain.ts";
import { formatGen, parseGen } from "../lib/format.ts";
import { useTx } from "../hooks.ts";
import { useSession } from "../wallet-context.ts";
import { Confirm, TxStatus } from "../components/Ui.tsx";

const TEMPLATES: { id: string; label: string; name: string; mandate: string; watch: string }[] = [
  {
    id: "green",
    label: "Renewable energy",
    name: "Green Transition Treasury",
    mandate: `Theme: renewable energy generation and storage: solar, wind, hydro, geothermal and grid batteries.
Exclusions: fossil-fuel extraction and generation (coal, oil, gas), and any project with documented labor-rights violations or fatal safety incidents.
Evidence standard: a named, public source describing the target's actual business.`,
    watch: "https://en.wikipedia.org/wiki/Renewable_energy",
  },
  {
    id: "oss",
    label: "Open-source infrastructure",
    name: "Open Infrastructure Fund",
    mandate: `Theme: maintained open-source software that other projects depend on (libraries, build tools, protocols).
Exclusions: projects with an unresolved, publicly documented security incident they have not disclosed, and projects whose licence has been changed to restrict existing users.
Evidence standard: the project's own repository, release notes or a named security advisory.`,
    watch: "",
  },
  {
    id: "bio",
    label: "Public-health research",
    name: "Public Health Research Pool",
    mandate: `Theme: peer-reviewed or publicly registered research on infectious-disease prevention and diagnostics.
Exclusions: groups with a documented research-integrity finding (retraction for misconduct) in the last five years.
Evidence standard: a registry entry, a journal page or an institutional announcement.`,
    watch: "",
  },
];

const WINDOWS: [string, number][] = [
  ["3 minutes (demo)", 180],
  ["1 hour", 3600],
  ["1 day", 86400],
  ["2 days", 172800],
  ["7 days", 604800],
];

export function CreateFund() {
  const { requireSigner, useDemoAccount } = useSession();
  const tx = useTx();
  const [tpl, setTpl] = useState("green");
  const [name, setName] = useState(TEMPLATES[0].name);
  const [mandate, setMandate] = useState(TEMPLATES[0].mandate);
  const [watch, setWatch] = useState(TEMPLATES[0].watch);
  const [single, setSingle] = useState("25");
  const [trade, setTrade] = useState("10");
  const [seed, setSeed] = useState("10");
  const [bond, setBond] = useState("0.1");
  const [appealBond, setAppealBond] = useState("0.1");
  const [windowS, setWindowS] = useState(172800);
  const [days, setDays] = useState("30");
  const [keeper, setKeeper] = useState("0.05");
  const [confirming, setConfirming] = useState(false);

  const seedWei = parseGen(seed);
  const bondWei = parseGen(bond);
  const appealWei = parseGen(appealBond);
  const keeperWei = parseGen(keeper);
  const singleBps = Math.round(Number(single) * 100);
  const tradeBps = Math.round(Number(trade) * 100);
  const dayN = Number(days);
  const watchUrls = watch.split(/\s+/).filter(Boolean);
  const problems: string[] = [];
  if (!name.trim() || name.length > 80) problems.push("Give the fund a name (up to 80 characters).");
  if (!mandate.trim() || mandate.length > 4000) problems.push("Write a mandate (up to 4,000 characters).");
  if (!(singleBps >= 100 && singleBps <= 10000)) problems.push("The single-name cap must be between 1% and 100%.");
  if (!(tradeBps >= 10 && tradeBps <= singleBps)) problems.push("The per-trade cap must be at least 0.1% and no more than the single-name cap.");
  if (!seedWei || seedWei < 1n) problems.push("Seed capital must be a positive amount of GEN.");
  if (!bondWei || bondWei < 1n || !appealWei || appealWei < 1n) problems.push("Both bonds must be positive amounts of GEN.");
  if (keeperWei === null || (seedWei !== null && keeperWei > seedWei / 100n)) problems.push("The keeper fee can be at most 1% of the seed capital.");
  if (!(dayN >= 1 && dayN <= 365)) problems.push("The fund must run between 1 and 365 days.");
  if (watchUrls.length > 3 || watchUrls.some((u) => !/^https:\/\//.test(u))) problems.push("Watch pages must be up to three public https URLs.");

  function pick(id: string) {
    const t = TEMPLATES.find((x) => x.id === id)!;
    setTpl(id);
    setName(t.name);
    setMandate(t.mandate);
    setWatch(t.watch);
  }

  async function submit() {
    setConfirming(false);
    const signer = requireSigner();
    if (!signer) return useDemoAccount();
    await tx.run(async (onPhase) => {
      const ends = (await chainNow()) + Math.round(dayN * 86400);
      return sendTx(
        signer,
        "create_fund",
        [name.trim(), mandate, BigInt(singleBps), BigInt(tradeBps), bondWei!, appealWei!, BigInt(windowS), BigInt(ends), watchUrls, keeperWei ?? 0n],
        seedWei!,
        onPhase,
      );
    });
  }

  return (
    <>
      <div className="crumb">
        <a href="#/">Funds</a> / New fund
      </div>
      <div className="eyebrow">Step 1 of 1 · everything below is frozen on creation</div>
      <h1 style={{ marginTop: 8 }}>Create a fund</h1>
      <p className="lede" style={{ marginTop: 10 }}>
        Write the mandate once. The caps, bonds, timings and watch pages are frozen with it, so members can trust the rules will not move. Your seed becomes your
        member stake.
      </p>

      <div className="card" style={{ marginTop: 28 }}>
        <label>Start from a template</label>
        <div className="chips">
          {TEMPLATES.map((t) => (
            <button key={t.id} className={`chipbtn ${tpl === t.id ? "on" : ""}`} onClick={() => pick(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <label htmlFor="name">Fund name</label>
        <input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <label htmlFor="mandate">Mandate, in plain English</label>
        <textarea id="mandate" value={mandate} onChange={(e) => setMandate(e.target.value)} rows={7} />
        <div className="hint">The jury reads this text verbatim against the evidence for every proposal. Say what is in theme, what is excluded, and what counts as evidence.</div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 14 }}>Limits the contract enforces</h3>
        <div className="fields">
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
        <div className="hint">Caps are shares of total member stake. They are checked by code, never by the model.</div>
        <div className="fields" style={{ marginTop: 6 }}>
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
          <div>
            <label htmlFor="keeper">Keeper fee per step (GEN)</label>
            <input id="keeper" inputMode="decimal" value={keeper} onChange={(e) => setKeeper(e.target.value)} />
          </div>
        </div>
        <div className="hint">
          Paid from idle GEN to whoever settles a step (a jury round, an execution, a scan, an expiry), so nothing needs an operator. At most 1% of the seed.
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 6 }}>Standing watch (optional)</h3>
        <p className="muted">
          Up to three trusted public pages, one per line. Anyone can later ask validators to read them against what the fund holds; a holding with documented
          adverse news is frozen until a later scan clears it. Choose sources you trust: a hostile page could freeze a holding, though it can never move money.
        </p>
        <textarea value={watch} onChange={(e) => setWatch(e.target.value)} rows={3} placeholder="https://…" style={{ marginTop: 12, minHeight: 76 }} aria-label="Watch pages" />
      </div>

      {problems.length > 0 && <div className="hint err">{problems[0]}</div>}
      <div className="actions">
        <button className="big-cta" disabled={problems.length > 0 || tx.busy} onClick={() => setConfirming(true)}>
          Freeze the mandate and create the fund
        </button>
      </div>
      <TxStatus state={tx.state} doneText="Fund created." />
      {tx.state.kind === "done" && !tx.state.outcome.error && (
        <p>
          <a href="#/">See it in the list</a>
        </p>
      )}
      <Confirm open={confirming} title="Freeze this mandate?" confirmLabel="Create fund" onConfirm={submit} onCancel={() => setConfirming(false)}>
        You are sending <b className="num">{seedWei ? formatGen(seedWei) : "?"} GEN</b> as seed capital. The mandate, caps ({single}% per name, {trade}% per trade),
        bonds, timings and {watchUrls.length} watch page{watchUrls.length === 1 ? "" : "s"} cannot be changed afterwards, by anyone. After the fund ends ({days} days) members
        can redeem what was never allocated.
      </Confirm>
    </>
  );
}
