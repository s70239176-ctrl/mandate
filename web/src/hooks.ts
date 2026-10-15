import { useCallback, useEffect, useRef, useState } from "react";
import { describeError } from "./lib/chain.ts";
import type { Phase, TxOutcome } from "./lib/types.ts";

export interface Loaded<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

export function useLoad<T>(loader: () => Promise<T>, deps: unknown[]): Loaded<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  useEffect(() => {
    let live = true;
    setLoading(true);
    loaderRef
      .current()
      .then((d) => live && (setData(d), setError(null)))
      .catch((e) => live && setError(describeError(e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, loading, reload: useCallback(() => setTick((t) => t + 1), []) };
}

export type TxState =
  | { kind: "idle" }
  | { kind: "running"; phase: Phase; detail?: string }
  | { kind: "done"; outcome: TxOutcome }
  | { kind: "error"; message: string };

export function useTx() {
  const [state, setState] = useState<TxState>({ kind: "idle" });
  const run = useCallback(async (fn: (onPhase: (p: Phase, d?: string) => void) => Promise<TxOutcome>): Promise<TxOutcome | null> => {
    setState({ kind: "running", phase: "signing" });
    try {
      const outcome = await fn((phase, detail) => setState({ kind: "running", phase, detail }));
      setState({ kind: "done", outcome });
      return outcome;
    } catch (e) {
      setState({ kind: "error", message: describeError(e) });
      return null;
    }
  }, []);
  const reset = useCallback(() => setState({ kind: "idle" }), []);
  return { state, run, busy: state.kind === "running", reset };
}

/** Re-render on an interval (for "time left" labels) without refetching anything. */
export function useNow(everyMs = 30000): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}
