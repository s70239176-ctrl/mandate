import { PolicyBuilder } from "../components/PolicyBuilder.tsx";

/** The same policy builder as the home page, with its details drawer open. */
export function CreateFund() {
  return (
    <>
      <div className="crumb">
        <a href="#/">Funds</a> / New policy
      </div>
      <div className="eyebrow">Everything below is frozen on creation</div>
      <h1 style={{ marginTop: 8 }}>Build a policy</h1>
      <p className="lede" style={{ marginTop: 10, marginBottom: 24 }}>
        Write the mandate once. The caps, bonds, timings and watch pages are frozen with it, so members can trust the rules will not move. Your seed becomes your
        member stake.
      </p>
      <PolicyBuilder defaultOpen />
    </>
  );
}
