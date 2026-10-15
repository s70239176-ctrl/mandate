import { ArrowRight, Coins, Gauge, Hourglass, Play, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { hasContract, listFunds, listProposers } from "../lib/chain.ts";
import { useLoad, useNow } from "../hooks.ts";
import { formatGen, shortAddr, timeLeft } from "../lib/format.ts";
import { fundSummary } from "../lib/view.ts";
import { Empty, ErrorBox, Section, Skeleton } from "../components/Ui.tsx";
import { PolicyBuilder, focusBuilder, type BuilderFocus } from "../components/PolicyBuilder.tsx";

const CATEGORIES: { id: BuilderFocus; icon: ReactNode; title: string; text: string }[] = [
  { id: "limit", icon: <Gauge size={17} strokeWidth={1.6} />, title: "Spending limits", text: "Set transaction caps" },
  { id: "scope", icon: <Coins size={17} strokeWidth={1.6} />, title: "Allowed assets", text: "Whitelist assets & tokens" },
  { id: "risk", icon: <ShieldAlert size={17} strokeWidth={1.6} />, title: "Risk rules", text: "Block high-risk activity" },
  { id: "time", icon: <Hourglass size={17} strokeWidth={1.6} />, title: "Time constraints", text: "Restrict by time or schedule" },
];

export function Home({ onTour, banners }: { onTour: () => void; banners: ReactNode }) {
  const now = useNow();
  const feed = useLoad(() => (hasContract ? listFunds(0, 20) : Promise.resolve(null)), []);
  const board = useLoad(() => (hasContract ? listProposers(8) : Promise.resolve([])), []);
  const funds = feed.data?.items ?? [];
  const totalIdle = funds.reduce((a, f) => a + f.free, 0n);
  const totalAllocated = funds.reduce((a, f) => a + f.allocated, 0n);
  const totalProposals = funds.reduce((a, f) => a + f.proposalCount, 0);

  return (
    <>
      <section className="cine" aria-label="Introduction">
        <div className="cine-art" aria-hidden="true" />
        <div className="cine-shade" aria-hidden="true" />
        <div className="cine-in">
          <div className="cine-copy">
            <h1>
              Build policies
              <br />
              that work.
            </h1>
            <p>Set your rules, define your limits, and give agents the authority to operate — safely.</p>
            <div className="cine-cta">
              <button className="outline" onClick={() => focusBuilder("scope")}>
                Create policy <ArrowRight size={15} />
              </button>
              {funds.length > 0 && (
                <button className="linkbtn" onClick={onTour}>
                  <Play size={12} /> 60-second tour
                </button>
              )}
            </div>
          </div>
          <ul className="cine-cards" aria-label="Policy controls">
            {CATEGORIES.map((c) => (
              <li key={c.id}>
                <button type="button" className="pcard" onClick={() => focusBuilder(c.id)}>
                  <span className="ic">{c.icon}</span>
                  <span className="pt">
                    <b>{c.title}</b>
                    <small>{c.text}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="cine-body">
        <PolicyBuilder onCreated={feed.reload} />
        {banners}

        <div id="funds" className="funds-anchor" />
        <Section
          title="Funds"
          aside={
            funds.length > 0 && (
              <span className="muted num" style={{ fontSize: 13 }}>
                {funds.length} fund{funds.length === 1 ? "" : "s"} · {totalProposals} proposals · {formatGen(totalAllocated)} GEN allocated · {formatGen(totalIdle)} idle
              </span>
            )
          }
        >
          {feed.loading && !feed.data && <Skeleton rows={4} />}
          {feed.error && <ErrorBox message={feed.error} onRetry={feed.reload} />}
          {feed.data && funds.length === 0 && <Empty title="No funds yet">Save a policy above to create the first one.</Empty>}
          <div className="stack">
            {funds.map((f) => (
              <a key={f.id} className="fund-card" href={`#/f/${f.id}`}>
                <div>
                  <h3>{f.name}</h3>
                  <div className="muted" style={{ marginTop: 4 }}>
                    {fundSummary(f)} · {f.proposalCount} proposals · {f.members} member{f.members === 1 ? "" : "s"}
                  </div>
                  <div className="dim" style={{ marginTop: 10, fontSize: 13.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {f.mandate.split("\n")[0]}
                  </div>
                </div>
                <div className="nums">
                  <div className="kv">
                    <span className="k">Idle</span>
                    <span className="v num">{formatGen(f.free)}</span>
                  </div>
                  <div className="kv">
                    <span className="k">Allocated</span>
                    <span className="v num">{formatGen(f.allocated)}</span>
                  </div>
                  <div className="kv">
                    <span className="k">{f.open ? "Ends in" : "Status"}</span>
                    <span className="v num">{f.open ? timeLeft(f.endsAt, now).replace(" left", "") : "ended"}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </Section>

        {board.data && board.data.length > 0 && (
          <Section title="Proposer track records" aside={<span className="dim" style={{ fontSize: 12.5 }}>public, on-chain, across every fund</span>}>
            <div className="tbl board">
              <div className="rowline hd">
                <span>#</span>
                <span>Proposer</span>
                <span className="n">Exec</span>
                <span className="n">Appr</span>
                <span className="n">Rej</span>
                <span className="n">Overt</span>
              </div>
              {board.data.map((r, i) => (
                <div key={r.address} className="rowline">
                  <span className="dim num">{i + 1}</span>
                  <span className="num">{shortAddr(r.address)}</span>
                  <span className="n mint">{r.executed}</span>
                  <span className="n">{r.approved}</span>
                  <span className="n">{r.rejected}</span>
                  <span className="n">{r.overturned}</span>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </>
  );
}
