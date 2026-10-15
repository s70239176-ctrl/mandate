import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface Stop {
  hash: string;
  title: string;
  body: string;
}

/** The 60-second walkthrough. It navigates through the seeded fund, so every stop is a real, live record. */
const STOPS: Stop[] = [
  {
    hash: "#/f/1",
    title: "A fund with a frozen mandate",
    body: "The gold block is the charter. It is plain English, written once, and nobody (including the creator) can change it. The caps beside it are enforced by code.",
  },
  {
    hash: "#/p/1",
    title: "A trade that went through",
    body: "Solar was approved by the jury, sat out the appeal window, passed a last look at the live evidence, then paid. Left: the contract's own checks. Right: what the validators answered.",
  },
  {
    hash: "#/p/3",
    title: "A trade that was refused, and why",
    body: "Coal is excluded by the mandate. The jury said so, the bond was slashed, and the page states the reason as a code you can audit.",
  },
  {
    hash: "#/p/2",
    title: "A member challenged a trade",
    body: "Any member can appeal one approved trade with a bond and a new public page. A second jury read it and dismissed it, so the proposal went on to execute.",
  },
  {
    hash: "#/how",
    title: "Nothing is hidden",
    body: "This page reads the deployed contract and shows the exact instructions validators receive, and the rules that are never given to a model.",
  },
];

export function Tour({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    window.location.hash = STOPS[i].hash;
  }, [i]);
  const s = STOPS[i];
  return (
    <aside className="tour" role="dialog" aria-label="Guided tour">
      <div className="row between">
        <span className="count">
          Tour · {i + 1} of {STOPS.length}
        </span>
        <button className="ghost small" aria-label="Close the tour" onClick={onClose} style={{ padding: "4px 8px" }}>
          <X size={14} />
        </button>
      </div>
      <h3>{s.title}</h3>
      <p>{s.body}</p>
      <div className="dots" aria-hidden="true">
        {STOPS.map((_, j) => (
          <i key={j} className={j <= i ? "on" : ""} />
        ))}
      </div>
      <div className="actions" style={{ marginTop: 14 }}>
        <button className="ghost small" disabled={i === 0} onClick={() => setI(i - 1)}>
          Back
        </button>
        {i < STOPS.length - 1 ? (
          <button className="small" onClick={() => setI(i + 1)}>
            Next
          </button>
        ) : (
          <button className="small" onClick={onClose}>
            Finish
          </button>
        )}
      </div>
    </aside>
  );
}
