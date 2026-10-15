import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Wallet, FlaskConical } from "lucide-react";
import { NETWORK } from "../lib/chain.ts";
import { shortAddr } from "../lib/format.ts";
import { useSession } from "../wallet-context.ts";

/** The brand mark: two nested triangles (a boundary, and what it contains). */
export function Mark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
      <path d="M16 3 29 27H3L16 3Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M16 13.5 21.2 23H10.8L16 13.5Z" fill="currentColor" />
    </svg>
  );
}

function AccountMenu() {
  const { signer, connectWallet, useDemoAccount, disconnect } = useSession();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const name = signer ? (signer.kind === "sandbox" ? "Demo account" : shortAddr(signer.address)) : "Guest";
  const role = signer ? (signer.kind === "sandbox" ? "Test GEN only" : "Wallet") : "Read-only";
  const initials = signer ? (signer.kind === "sandbox" ? "DA" : signer.address.slice(2, 4).toUpperCase()) : "G";

  return (
    <div className="acct" ref={box}>
      <button type="button" className="acct-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="avatar" aria-hidden="true">
          {initials}
        </span>
        <span className="who">
          <b>{name}</b>
          <small>{role}</small>
        </span>
        <ChevronDown size={14} className="dim" />
      </button>
      {open && (
        <div className="acct-menu" role="menu">
          <div className="net-row">
            <span className="net">{NETWORK}</span>
          </div>
          {!signer && (
            <>
              <button role="menuitem" onClick={() => (setOpen(false), connectWallet())}>
                <Wallet size={14} /> Connect wallet
              </button>
              <button role="menuitem" onClick={() => (setOpen(false), useDemoAccount())}>
                <FlaskConical size={14} /> Use demo account
              </button>
            </>
          )}
          {signer && (
            <>
              <div className="addr mono" title={signer.address}>
                {signer.address}
              </div>
              <button role="menuitem" onClick={() => (setOpen(false), disconnect())}>
                <LogOut size={14} /> Disconnect
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function Header({ overlay, active }: { overlay: boolean; active: string }) {
  return (
    <header className={`topbar ${overlay ? "overlay" : ""}`}>
      <div className="in">
        <a className="mark" href="#/" aria-label="Mandate home">
          <Mark /> <span>MANDATE</span>
        </a>
        <nav className="toplinks" aria-label="Main">
          <a href="#/" className={active === "home" ? "on" : ""}>
            Funds
          </a>
          <a href="#/how" className={active === "how" ? "on" : ""}>
            How it decides
          </a>
        </nav>
        <AccountMenu />
      </div>
    </header>
  );
}
