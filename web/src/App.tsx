import { useCallback, useEffect, useMemo, useState } from "react";
import { Ctx, type Session } from "./wallet-context.ts";
import { connectWallet, createSandbox, forgetSandbox, getProvider, loadSandbox, type Signer } from "./lib/signer.ts";
import { describeError, hasContract, NETWORK } from "./lib/chain.ts";
import { shortAddr } from "./lib/format.ts";
import { Logo } from "./components/Ui.tsx";
import { Home } from "./screens/Home.tsx";
import { CreateFund } from "./screens/CreateFund.tsx";
import { FundPage } from "./screens/FundPage.tsx";
import { ProposePage } from "./screens/ProposePage.tsx";
import { ProposalPage } from "./screens/ProposalPage.tsx";
import { HowPage } from "./screens/HowPage.tsx";
import { Tour } from "./components/Tour.tsx";

function useHashRoute(): string {
  const [hash, setHash] = useState(window.location.hash || "#/");
  useEffect(() => {
    const on = () => {
      setHash(window.location.hash || "#/");
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
}

/** Routes (hash-based, so deep links work on any static host): #/  #/create  #/f/:id  #/f/:id/propose  #/p/:id */
export function App() {
  const hash = useHashRoute();
  const [signer, setSigner] = useState<Signer | null>(() => loadSandbox());
  const [error, setError] = useState<string | null>(null);
  const [tour, setTour] = useState(false);

  useEffect(() => {
    getProvider()?.on?.("accountsChanged", (a) => {
      setSigner((cur) => (cur?.kind === "wallet" ? (a[0] ? { kind: "wallet", address: a[0].toLowerCase() } : null) : cur));
    });
  }, []);

  const doConnect = useCallback(async () => {
    try {
      setError(null);
      setSigner(await connectWallet());
    } catch (e) {
      setError(describeError(e));
    }
  }, []);
  const useDemoAccount = useCallback(() => {
    setError(null);
    setSigner(loadSandbox() ?? createSandbox());
  }, []);
  const disconnect = useCallback(() => {
    if (signer?.kind === "sandbox") forgetSandbox();
    setSigner(null);
  }, [signer]);

  const session: Session = useMemo(
    () => ({ signer, me: signer?.address ?? "", connectWallet: doConnect, useDemoAccount, disconnect, requireSigner: () => signer, error }),
    [signer, doConnect, useDemoAccount, disconnect, error],
  );

  const parts = hash.replace(/^#\/?/, "").split("/");
  let page = <Home onTour={() => setTour(true)} />;
  let active = "home";
  if (parts[0] === "how") {
    page = <HowPage />;
    active = "how";
  } else if (parts[0] === "create") {
    page = <CreateFund />;
    active = "create";
  } else if (parts[0] === "f" && parts[1] && parts[2] === "propose") {
    page = <ProposePage id={Number(parts[1])} />;
    active = "home";
  } else if (parts[0] === "f" && parts[1]) {
    page = <FundPage id={Number(parts[1])} />;
    active = "home";
  } else if (parts[0] === "p" && parts[1]) {
    page = <ProposalPage id={Number(parts[1])} />;
    active = "home";
  }

  return (
    <Ctx.Provider value={session}>
      <header className="nav">
        <div className="in">
          <a className="brand" href="#/">
            <Logo /> Mandate
          </a>
          <nav className="links" aria-label="Main">
            <a href="#/" className={active === "home" ? "on" : ""}>
              Funds
            </a>
            <a href="#/create" className={active === "create" ? "on" : ""}>
              Create a fund
            </a>
            <a href="#/how" className={active === "how" ? "on" : ""}>
              How it decides
            </a>
          </nav>
          <span className="net hide-sm">{NETWORK}</span>
          {signer ? (
            <div className="row">
              <span className="mono muted" title={signer.address}>
                {signer.kind === "sandbox" ? "demo " : ""}
                {shortAddr(signer.address)}
              </span>
              <button className="ghost small" onClick={disconnect}>
                Disconnect
              </button>
            </div>
          ) : (
            <div className="row">
              <button className="ghost small" onClick={doConnect}>
                Connect wallet
              </button>
              <button className="small" onClick={useDemoAccount}>
                Use demo account
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="wrap">
        {error && (
          <div className="tx err" role="alert">
            {error}
          </div>
        )}
        {!hasContract && (
          <div className="tx err" role="alert">
            No contract is configured. Set <span className="mono">VITE_CONTRACT_ADDRESS</span> to a deployed Mandate address on {NETWORK}.
          </div>
        )}
        {signer?.kind === "sandbox" && (
          <div className="banner">
            <b>Demo account.</b> A throwaway key stored in this browser, for {NETWORK} test GEN only. Never send real funds to it.
          </div>
        )}
        {page}
        {tour && <Tour onClose={() => setTour(false)} />}
        <p className="footer">
          Mandate does not trade tokens and is not investment advice. The treasury holds native GEN and an allocation is a payment to a named
          payee address. It only reads public pages: it never executes anything it finds in them, and text inside a page is evidence, never a command.
        </p>
      </main>
    </Ctx.Provider>
  );
}
