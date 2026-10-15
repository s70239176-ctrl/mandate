import { useState } from "react";
import { Cpu, Gavel, Scale } from "lucide-react";
import { getPrompts, hasContract } from "../lib/chain.ts";
import { useLoad } from "../hooks.ts";
import { ErrorBox, Section, Skeleton } from "../components/Ui.tsx";

const TABS = [
  { id: "proposal", label: "Judging a proposal", note: "Run when anyone asks the jury to read a proposal's evidence." },
  { id: "appeal", label: "Judging an appeal", note: "Run when a member challenges an approved allocation." },
  { id: "lastLook", label: "Last look at execution", note: "Run just before GEN moves, over the live pages." },
  { id: "scan", label: "Standing watch", note: "Run over the fund's frozen watch pages and its holdings." },
] as const;

/** Highlights the placeholders the contract fills in, so the fixed instructions stand out from the case-specific text. */
function Highlighted({ text }: { text: string }) {
  const parts = text.split(/(<[a-z][^<>\n]{0,40}>)/g);
  return (
    <>
      {parts.map((p, i) => (/^<[a-z][^<>\n]{0,40}>$/.test(p) ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>))}
    </>
  );
}

export function HowPage() {
  const prompts = useLoad(() => (hasContract ? getPrompts() : Promise.resolve(null)), []);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("proposal");
  const active = TABS.find((t) => t.id === tab)!;

  return (
    <>
      <div className="crumb">
        <a href="#/">Funds</a> / How it decides
      </div>
      <div className="eyebrow">Nothing hidden</div>
      <h1 style={{ marginTop: 8 }}>How the contract decides</h1>
      <p className="lede" style={{ marginTop: 10 }}>
        A model is asked a handful of narrow true/false questions about public pages. Everything that moves money is ordinary code. Below are the exact
        instructions every validator receives, read live from the deployed contract, and the rules that are never given to a model.
      </p>

      <Section title="Who decides what">
        <div className="flowline">
          <div className="box model">
            <b>
              <Cpu size={15} style={{ verticalAlign: -2, marginRight: 6 }} className="mint" />
              Validators (model)
            </b>
            <span>Is the target in theme? Is something excluded documented? Is there a material adverse development? Does an appeal page substantiate a violation?</span>
          </div>
          <div className="box code">
            <b>
              <Scale size={15} style={{ verticalAlign: -2, marginRight: 6 }} className="gold" />
              The contract (code)
            </b>
            <span>Caps, idle balance, evidence fingerprints, timelock, bonds, who may appeal, the settlement table, every payment.</span>
          </div>
          <div className="box">
            <b>
              <Gavel size={15} style={{ verticalAlign: -2, marginRight: 6 }} />
              Consensus
            </b>
            <span>A result stands only if every validator&apos;s independently fetched answer equals the leader&apos;s. Prose and reason labels are never compared.</span>
          </div>
        </div>
      </Section>

      <Section title="The exact instructions">
        <div className="chips">
          {TABS.map((t) => (
            <button key={t.id} className={`chipbtn ${tab === t.id ? "on" : ""}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <p className="muted" style={{ marginBottom: 12 }}>
          {active.note} <span className="dim">Highlighted text is filled in per case; the rest is fixed in the contract.</span>
        </p>
        {prompts.loading && !prompts.data && <Skeleton rows={6} />}
        {prompts.error && <ErrorBox message={prompts.error} onRetry={prompts.reload} />}
        {!hasContract && <p className="muted">Connect a deployed contract to read its instructions.</p>}
        {prompts.data && (
          <div className="codeblock">
            <Highlighted text={prompts.data[tab]} />
          </div>
        )}
      </Section>

      {prompts.data && (
        <Section title="Never asked of a model">
          <div className="card">
            <ul style={{ margin: 0, paddingLeft: 18 }} className="stack">
              {prompts.data.rules.map((r) => (
                <li key={r} className="mono" style={{ fontSize: 13 }}>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}

      <Section title="Defences">
        <div className="cols">
          <div className="card">
            <h3>Hostile pages</h3>
            <p className="muted" style={{ marginTop: 6 }}>
              Page text is fenced and labelled untrusted data. A validator that obeys an injected instruction produces a different answer from an honest one,
              so consensus rejects it.
            </p>
          </div>
          <div className="card">
            <h3>Changed evidence</h3>
            <p className="muted" style={{ marginTop: 6 }}>
              Every page is committed by fingerprint. If it changes before the jury reads it, the proposal is rejected without asking the model. At execution
              the pages are re-read live and a trade is blocked if something adverse has appeared.
            </p>
          </div>
          <div className="card">
            <h3>Fail-safe direction</h3>
            <p className="muted" style={{ marginTop: 6 }}>
              If validators cannot agree, nothing moves and the proposal waits or expires. Unreadable evidence is retried a bounded number of times, then the
              step ends without paying anyone.
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}
