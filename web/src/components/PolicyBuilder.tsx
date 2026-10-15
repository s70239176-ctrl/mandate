import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronDown, Lock, ShieldCheck } from "lucide-react";
import { chainNow, sendTx } from "../lib/chain.ts";
import { formatGen, parseGen } from "../lib/format.ts";
import { useTx } from "../hooks.ts";
import { useSession } from "../wallet-context.ts";
import { Confirm, TxStatus } from "./Ui.tsx";

interface Template {
  id: string;
  label: string;
  name: string;
  theme: string;
  exclusions: string;
  evidence: string;
  watch: string;
}

const TEMPLATES: Template[] = [
  {
    id: "green",
    label: "Renewable energy",
    name: "Green Transition Treasury",
    theme: "renewable energy generation and storage: solar, wind, hydro, geothermal and grid batteries",
    exclusions: "fossil-fuel extraction and generation (coal, oil, gas), and any project with documented labor-rights violations or fatal safety incidents",
    evidence: "a named, public source describing the target's actual business",
    watch: "https://en.wikipedia.org/wiki/Renewable_energy",
  },
  {
    id: "oss",
    label: "Open-source infrastructure",
    name: "Open Infrastructure Fund",
    theme: "maintained open-source software that other projects depend on (libraries, build tools, protocols)",
    exclusions: "projects with an unresolved, publicly documented security incident they have not disclosed, and projects whose licence has been changed to restrict existing users",
    evidence: "the project's own repository, release notes or a named security advisory",
    watch: "",
  },
  {
    id: "bio",
    label: "Public-health research",
    name: "Public Health Research Pool",
    theme: "peer-reviewed or publicly registered research on infectious-disease prevention and diagnostics",
    exclusions: "groups with a documented research-integrity finding (retraction for misconduct) in the last five years",
    evidence: "a registry entry, a journal page or an institutional announcement",
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

export type BuilderFocus = "limit" | "scope" | "risk" | "time";

/** Cards elsewhere on the page ask the builder to focus a control; this is the only coupling. */
export const focusBuilder = (id: BuilderFocus) => window.dispatchEvent(new CustomEvent("mandate:focus", { detail: id }));

export function PolicyBuilder({ defaultOpen = false, onCreated }: { defaultOpen?: boolean; onCreated?: () => void }) {
  const { requireSigner, useDemoAccount } = useSession();
  const tx = useTx();
  const first = TEMPLATES[0];
  const [tpl, setTpl] = useState(first.id);
  const [name, setName] = useState(first.name);
  const [theme, setTheme] = useState(first.theme);
  const [exclusions, setExclusions] = useState(first.exclusions);
  const [evidence, setEvidence] = useState(first.evidence);
  const [watch, setWatch] = useState(first.watch);
  const [trade, setTrade] = useState("10");
  const [single, setSingle] = useState("25");
  const [seed, setSeed] = useState("10");
  const [bond, setBond] = useState("0.1");
  const [appealBond, setAppealBond] = useState("0.1");
  const [windowS, setWindowS] = useState(172800);
  const [days, setDays] = useState("30");
  const [keeper, setKeeper] = useState("0.05");
  const [open, setOpen] = useState(defaultOpen);
  const [confirming, setConfirming] = useState(false);
  const [touched, setTouched] = useState(false);

  const limitRef = useRef<HTMLInputElement>(null);
  const themeRef = useRef<HTMLInputElement>(null);
  const exclRef = useRef<HTMLTextAreaElement>(null);
  const winRef = useRef<HTMLSelectElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const on = (e: Event) => {
      const id = (e as CustomEvent<BuilderFocus>).detail;
      panelRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
      if (id === "risk" || id === "time") setOpen(true);
      // wait a frame so a just-opened drawer exists before it is focused
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const target = id === "limit" ? limitRef.current : id === "scope" ? themeRef.current : id === "risk" ? exclRef.current : winRef.current;
        target?.focus({ preventScroll: true });
      }));
    };
    window.addEventListener("mandate:focus", on);
    return () => window.removeEventListener("mandate:focus", on);
  }, []);

  const seedWei = parseGen(seed);
  const bondWei = parseGen(bond);
  const appealWei = parseGen(appealBond);
  const keeperWei = parseGen(keeper);
  const tradeBps = Math.round(Number(trade) * 100);
  const singleBps = Math.round(Number(single) * 100);
  const dayN = Number(days);
  const watchUrls = watch.split(/\s+/).filter(Boolean);
  const mandate = useMemo(
    () => `Theme: ${theme.trim()}.\nExclusions: ${exclusions.trim() || "none stated"}.\nEvidence standard: ${evidence.trim() || "a named, public source"}.`,
    [theme, exclusions, evidence],
  );

  const errors: Record<string, string> = {};
  if (!name.trim() || name.length > 80) errors.name = "Name the fund (up to 80 characters).";
  if (!theme.trim()) errors.theme = "Say what is in scope.";
  if (mandate.length > 4000) errors.theme = "The mandate is over 4,000 characters.";
  if (!(tradeBps >= 10 && tradeBps <= 10000)) errors.trade = "Per-trade cap: 0.1% to 100%.";
  if (!(singleBps >= 100 && singleBps <= 10000)) errors.single = "Per-name cap: 1% to 100%.";
  else if (tradeBps > singleBps) errors.trade = "Per-trade cap cannot exceed the per-name cap.";
  if (!seedWei || seedWei < 1n) errors.seed = "Seed must be a positive amount of GEN.";
  if (!bondWei || bondWei < 1n || !appealWei || appealWei < 1n) errors.bond = "Both bonds must be positive.";
  if (keeperWei === null || (seedWei !== null && keeperWei > seedWei / 100n)) errors.keeper = "At most 1% of the seed.";
  if (!(dayN >= 1 && dayN <= 365)) errors.days = "Between 1 and 365 days.";
  if (watchUrls.length > 3 || watchUrls.some((u) => !/^https:\/\//.test(u))) errors.watch = "Up to three public https URLs.";
  const firstError = Object.values(errors)[0];

  function pick(id: string) {
    const t = TEMPLATES.find((x) => x.id === id)!;
    setTpl(id);
    setName(t.name);
    setTheme(t.theme);
    setExclusions(t.exclusions);
    setEvidence(t.evidence);
    setWatch(t.watch);
  }

  function save() {
    setTouched(true);
    if (firstError) {
      if (errors.name || errors.watch || errors.seed || errors.bond || errors.keeper || errors.days) setOpen(true);
      return;
    }
    setConfirming(true);
  }

  async function submit() {
    setConfirming(false);
    const signer = requireSigner();
    if (!signer) return useDemoAccount();
    const out = await tx.run(async (onPhase) => {
      const ends = (await chainNow()) + Math.round(dayN * 86400);
      return sendTx(
        signer,
        "create_fund",
        [name.trim(), mandate, BigInt(singleBps), BigInt(tradeBps), bondWei!, appealWei!, BigInt(windowS), BigInt(ends), watchUrls, keeperWei ?? 0n],
        seedWei!,
        onPhase,
      );
    });
    if (out && !out.error) onCreated?.();
  }

  const show = (k: string) => (touched && errors[k] ? errors[k] : "");
  const sentence = `Allow proposers to allocate up to ${trade || "…"}% of the fund per trade, and no more than ${single || "…"}% in any one name, when public evidence fits "${theme.trim().slice(0, 60) || "the mandate"}${theme.trim().length > 60 ? "…" : ""}" and every evidence page is fingerprint-committed.`;

  return (
    <section ref={panelRef} className="pb" id="policy-builder" aria-labelledby="pb-title">
      <div className="pb-head">
        <div>
          <h2 id="pb-title" className="pb-title">
            Policy builder
          </h2>
          <p className="pb-sentence" aria-live="polite">
            {sentence} <span className="pb-ill">Illustrative until saved.</span>
          </p>
        </div>
      </div>

      <div className="pb-row">
        <div className="pb-group">
          <label htmlFor="pb-asset">Asset</label>
          <div className="pb-val">
            <select id="pb-asset" value="GEN" onChange={() => {}} aria-describedby="pb-asset-note">
              <option value="GEN">GEN</option>
            </select>
          </div>
          <span id="pb-asset-note" className="sr">
            GEN is the only asset the treasury can hold.
          </span>
        </div>

        <div className={`pb-group wide ${show("trade") || show("single") ? "bad" : ""}`}>
          <label htmlFor="pb-trade">Limit</label>
          <div className="pb-val two">
            <span className="pb-pre">
              <input id="pb-trade" ref={limitRef} inputMode="decimal" value={trade} onChange={(e) => setTrade(e.target.value)} aria-invalid={!!show("trade")} aria-label="Maximum per trade, percent of fund" />%
              <small>per trade</small>
            </span>
            <span className="pb-pre">
              <input id="pb-single" inputMode="decimal" value={single} onChange={(e) => setSingle(e.target.value)} aria-invalid={!!show("single")} aria-label="Maximum in any one name, percent of fund" />%
              <small>per name</small>
            </span>
          </div>
        </div>

        <div className={`pb-group grow ${show("theme") ? "bad" : ""}`}>
          <label htmlFor="pb-theme">Condition</label>
          <div className="pb-val">
            <input id="pb-theme" ref={themeRef} className="pb-text" value={theme} onChange={(e) => setTheme(e.target.value)} aria-invalid={!!show("theme")} placeholder="what is in scope" />
          </div>
        </div>

        <div className="pb-group proof">
          <span className="pb-lab" id="pb-proof-l">
            Require proof
          </span>
          <div className="pb-val">
            <button
              type="button"
              role="switch"
              aria-checked="true"
              aria-labelledby="pb-proof-l"
              aria-describedby="pb-proof-note"
              className="switch on locked"
              onClick={() => {}}
              title="Always on: every evidence page is committed by fingerprint and checked before the jury is asked."
            >
              <i />
            </button>
            <span className="pb-on">
              <Lock size={11} /> On
            </span>
          </div>
          <span id="pb-proof-note" className="sr">
            Always on. Every evidence page is committed by fingerprint and checked before the jury is asked.
          </span>
        </div>

        <button type="button" className="pb-save" onClick={save} disabled={tx.busy}>
          Save policy <ArrowRight size={14} />
        </button>
      </div>

      {touched && firstError && (
        <p className="pb-err" role="alert">
          {firstError}
        </p>
      )}

      <button type="button" className="pb-more" aria-expanded={open} aria-controls="pb-details" onClick={() => setOpen((v) => !v)}>
        {open ? "Hide details" : "Mandate text, bonds, timings and watch pages"} <ChevronDown size={14} style={{ transform: open ? "rotate(180deg)" : "none" }} />
      </button>

      {open && (
        <div id="pb-details" className="pb-details">
          <div className="chips" role="group" aria-label="Start from a template">
            {TEMPLATES.map((t) => (
              <button key={t.id} type="button" className={`chipbtn ${tpl === t.id ? "on" : ""}`} onClick={() => pick(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="fields">
            <div>
              <label htmlFor="pb-name">Fund name</label>
              <input id="pb-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} aria-invalid={!!show("name")} />
              {show("name") && <div className="hint err">{show("name")}</div>}
            </div>
            <div>
              <label htmlFor="pb-seed">Seed capital (GEN)</label>
              <input id="pb-seed" inputMode="decimal" value={seed} onChange={(e) => setSeed(e.target.value)} aria-invalid={!!show("seed")} />
            </div>
            <div>
              <label htmlFor="pb-days">Runs for (days)</label>
              <input id="pb-days" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} aria-invalid={!!show("days")} />
            </div>
          </div>
          <label htmlFor="pb-excl">Exclusions: what the jury must refuse (risk rules)</label>
          <textarea id="pb-excl" ref={exclRef} value={exclusions} onChange={(e) => setExclusions(e.target.value)} rows={3} />
          <label htmlFor="pb-evid">Evidence standard</label>
          <textarea id="pb-evid" value={evidence} onChange={(e) => setEvidence(e.target.value)} rows={2} />
          <div className="hint">The jury reads this mandate verbatim against the evidence for every proposal. It is frozen when you save.</div>
          <div className="fields" style={{ marginTop: 4 }}>
            <div>
              <label htmlFor="pb-bond">Proposal bond (GEN)</label>
              <input id="pb-bond" inputMode="decimal" value={bond} onChange={(e) => setBond(e.target.value)} aria-invalid={!!show("bond")} />
            </div>
            <div>
              <label htmlFor="pb-abond">Appeal bond (GEN)</label>
              <input id="pb-abond" inputMode="decimal" value={appealBond} onChange={(e) => setAppealBond(e.target.value)} />
            </div>
            <div>
              <label htmlFor="pb-win">Appeal window (time constraint)</label>
              <select id="pb-win" ref={winRef} value={windowS} onChange={(e) => setWindowS(Number(e.target.value))}>
                {WINDOWS.map(([label, s]) => (
                  <option key={s} value={s}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="pb-keeper">Keeper fee per step (GEN)</label>
              <input id="pb-keeper" inputMode="decimal" value={keeper} onChange={(e) => setKeeper(e.target.value)} aria-invalid={!!show("keeper")} />
              {show("keeper") && <div className="hint err">{show("keeper")}</div>}
            </div>
          </div>
          <label htmlFor="pb-watch">Standing watch pages (optional, one per line, up to three)</label>
          <textarea id="pb-watch" value={watch} onChange={(e) => setWatch(e.target.value)} rows={2} placeholder="https://…" aria-invalid={!!show("watch")} />
          {show("watch") && <div className="hint err">{show("watch")}</div>}
          <div className="hint">
            Validators read these pages against what the fund holds and freeze any holding with documented adverse news. Choose sources you trust: a hostile page
            could freeze a holding, though it can never move money.
          </div>
        </div>
      )}

      <TxStatus state={tx.state} doneText="Fund created on-chain." />
      {tx.state.kind === "done" && !tx.state.outcome.error && (
        <p className="pb-done">
          <ShieldCheck size={14} /> Saved.{" "}
          <a
            href="#/"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("funds")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Find it in the funds list
          </a>
          .
        </p>
      )}

      <Confirm open={confirming} title="Freeze this policy?" confirmLabel="Create fund" onConfirm={submit} onCancel={() => setConfirming(false)}>
        You are sending <b className="num">{seedWei ? formatGen(seedWei) : "?"} GEN</b> as seed capital to a new fund on GenLayer Studionet. The mandate, the caps ({trade}% per
        trade, {single}% per name), bonds, timings and {watchUrls.length} watch page{watchUrls.length === 1 ? "" : "s"} cannot be changed afterwards, by anyone. Evidence
        fingerprints are always required.
      </Confirm>
    </section>
  );
}
