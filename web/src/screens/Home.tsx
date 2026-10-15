import { hasContract, listFunds } from "../lib/chain.ts";
import { useLoad, useNow } from "../hooks.ts";
import { formatGen, timeLeft } from "../lib/format.ts";
import { fundSummary } from "../lib/view.ts";
import { Empty, ErrorBox, Skeleton } from "../components/Ui.tsx";

export function Home() {
  const now = useNow();
  const feed = useLoad(() => (hasContract ? listFunds(0, 20) : Promise.resolve(null)), []);
  return (
    <>
      <section className="hero">
        <h1>
          A treasury that reads the <em>world</em> before it moves.
        </h1>
        <p className="lede">
          Members fund a treasury and freeze a written mandate. Anyone can propose an allocation with public evidence. GenLayer validators each read that
          evidence themselves and decide whether it fits the mandate. Members never vote on a rebalance. They appeal one trade at a time, and only when
          they can point to evidence.
        </p>
        <div className="rules">
          <div className="rule">
            <b>The mandate is frozen</b>Plain English, written once. No admin can change it, and no operator holds the keys.
          </div>
          <div className="rule">
            <b>Limits are code, not judgement</b>Single-name cap, trade size and idle balance are enforced by the contract, not asked of a model.
          </div>
          <div className="rule">
            <b>Every trade can be appealed</b>An approved allocation waits out a window. A member can challenge it with a bond and a public page.
          </div>
        </div>
        <div className="actions" style={{ marginBottom: 26 }}>
          <a href="#/create">
            <button>Create a fund</button>
          </a>
        </div>
      </section>

      <h2>Funds</h2>
      {feed.loading && !feed.data && <Skeleton rows={4} />}
      {feed.error && <ErrorBox message={feed.error} onRetry={feed.reload} />}
      {feed.data && feed.data.items.length === 0 && <Empty>No funds yet. Create the first one.</Empty>}
      {feed.data && feed.data.items.length > 0 && (
        <div className="tbl">
          <table>
            <thead>
              <tr>
                <th>Fund</th>
                <th className="hide-sm">Limits</th>
                <th className="num">Idle</th>
                <th className="num hide-sm">Allocated</th>
                <th className="num hide-sm">Members</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {feed.data.items.map((f) => (
                <tr key={f.id} className="hover" onClick={() => (window.location.hash = `#/f/${f.id}`)}>
                  <td>
                    <a href={`#/f/${f.id}`}>{f.name}</a>
                    <div className="sub">{f.proposalCount} proposals</div>
                  </td>
                  <td className="hide-sm muted">{fundSummary(f)}</td>
                  <td className="num">{formatGen(f.free)}</td>
                  <td className="num hide-sm">{formatGen(f.allocated)}</td>
                  <td className="num hide-sm">{f.members}</td>
                  <td className="muted">{f.open ? timeLeft(f.endsAt, now) : "ended"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
