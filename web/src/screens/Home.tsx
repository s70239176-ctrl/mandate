import { ArrowRight, Eye, Gavel, Lock, Play } from "lucide-react";
import { hasContract, listFunds, listProposers } from "../lib/chain.ts";
import { useLoad, useNow } from "../hooks.ts";
import { formatGen, shortAddr, timeLeft } from "../lib/format.ts";
import { fundSummary } from "../lib/view.ts";
import { Empty, ErrorBox, Section, Skeleton } from "../components/Ui.tsx";

export function Home({ onTour }: { onTour: () => void }) {
  const now = useNow();
  const feed = useLoad(() => (hasContract ? listFunds(0, 20) : Promise.resolve(null)), []);
  const board = useLoad(() => (hasContract ? listProposers(8) : Promise.resolve([])), []);
  const funds = feed.data?.items ?? [];
  const totalIdle = funds.reduce((a, f) => a + f.free, 0n);
  const totalAllocated = funds.reduce((a, f) => a + f.allocated, 0n);
  const totalProposals = funds.reduce((a, f) => a + f.proposalCount, 0);

  return (
    <>
      <section className="hero">
        <div>
          <div className="eyebrow">Treasury · mandate-bound · GenLayer</div>
          <h1>
            A treasury that <em>reads the world</em> before it moves.
          </h1>
          <p className="lede">
            Members freeze a written mandate. Anyone can propose an allocation with public evidence. Independent GenLayer validators read that evidence
            themselves and decide whether it fits. Nobody votes on a rebalance, and nobody holds the keys.
          </p>
          <div className="cta">
            {funds.length > 0 ? (
              <a href={`#/f/${funds[0].id}`}>
                <button className="big-cta">
                  Open the live demo fund <ArrowRight size={16} />
                </button>
              </a>
            ) : (
              <a href="#/create">
                <button className="big-cta">Create a fund</button>
              </a>
            )}
            {funds.length > 0 && (
              <button className="ghost big-cta" onClick={onTour}>
                <Play size={15} /> 60-second tour
              </button>
            )}
            {funds.length > 0 && (
              <a href="#/create">
                <button className="ghost big-cta">Create a fund</button>
              </a>
            )}
          </div>
        </div>
        <div className="flow" aria-label="How a decision is made">
          <ol>
            <li>
              <div>
                <b>Propose</b>
                <span>A target, a payee, an amount and 1–3 public pages, each committed by fingerprint.</span>
              </div>
            </li>
            <li className="hot">
              <div>
                <b>The jury reads the evidence</b>
                <span>Each validator fetches every page itself and answers four true/false questions.</span>
              </div>
            </li>
            <li>
              <div>
                <b>The contract applies the rules</b>
                <span>Single-name cap, trade size, idle balance and the settlement table. No model involved.</span>
              </div>
            </li>
            <li>
              <div>
                <b>Appeal, then execute</b>
                <span>Any member can challenge one trade with a bond and a page. Otherwise it pays out.</span>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <div className="principles">
        <div className="principle">
          <b>
            <Lock size={16} className="gold" /> The mandate is frozen
          </b>
          <p>Plain English, written once. No admin can change it, and there is no operator key to steal.</p>
        </div>
        <div className="principle">
          <b>
            <Gavel size={16} className="mint" /> Limits are code, not opinion
          </b>
          <p>Concentration, trade size and idle balance are checked by the contract. The model is never asked.</p>
        </div>
        <div className="principle">
          <b>
            <Eye size={16} className="mint" /> A standing watch
          </b>
          <p>Validators re-read the fund&apos;s watch pages and freeze any holding with documented adverse news.</p>
        </div>
      </div>

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
        {feed.data && funds.length === 0 && (
          <Empty title="No funds yet">Create the first one, or point this build at a seeded deployment.</Empty>
        )}
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
    </>
  );
}
