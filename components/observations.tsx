"use client";

import { AlertCircle, Check, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ObservationMutation } from "@/lib/catalog";

type Phase = "loading" | "ready" | "error";
type Change = ObservationMutation & { title: string };

type ObservationState = {
  phase: Phase;
  objectIds: string[];
  pendingId: string | null;
  failed: Change | null;
  dismissFailed: () => void;
  change: (mutation: Change) => Promise<void>;
  reload: () => void;
};

const Observations = createContext<ObservationState | null>(null);
const endpoint = "/api/observaciones";

async function readList(signal?: AbortSignal): Promise<string[]> {
  const response = await fetch(endpoint, { signal, cache: "no-store" });
  if (!response.ok) throw new Error("No se pudo leer la lista.");
  const data: { objectIds: string[] } = await response.json();
  return data.objectIds;
}

function sendChange({ objectId, saved }: Change) {
  return fetch(endpoint, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ objectId, saved }),
  });
}

export function ObservationProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [objectIds, setObjectIds] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [failed, setFailed] = useState<Change | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const inFlight = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    readList(controller.signal).then(
      (ids) => {
        if (controller.signal.aborted) return;
        setObjectIds(ids);
        setPhase("ready");
      },
      () => {
        if (!controller.signal.aborted) setPhase("error");
      },
    );

    return () => controller.abort();
  }, [attempt]);

  const reload = useCallback(() => {
    setPhase("loading");
    setAttempt((value) => value + 1);
  }, []);

  async function change(mutation: Change) {
    if (inFlight.current || phase !== "ready") return;

    inFlight.current = true;
    setPendingId(mutation.objectId);
    setFailed(null);
    setAnnouncement("");

    try {
      let response = await sendChange(mutation);
      if (response.status === 409) {
        const ids = await readList();
        setObjectIds(ids);
        response = await sendChange(mutation);
      }
      if (!response.ok) throw new Error("No se pudo actualizar la lista.");

      setObjectIds((previous) => {
        const remaining = previous.filter((id) => id !== mutation.objectId);
        return mutation.saved ? [mutation.objectId, ...remaining] : remaining;
      });
      setAnnouncement(mutation.saved ? mutation.title + " guardado." : "Objeto eliminado de tu lista.");
    } catch {
      setFailed(mutation);
    } finally {
      inFlight.current = false;
      setPendingId(null);
    }
  }

  return (
    <Observations.Provider value={{
      phase, objectIds, pendingId, failed, dismissFailed: () => setFailed(null), change, reload,
    }}>
      {children}
      <span className="sr-only" role="status">{announcement}</span>
      <MutationNotice />
    </Observations.Provider>
  );
}

export function useObservations() {
  const context = useContext(Observations);
  if (!context) throw new Error("ObservationProvider es obligatorio.");
  return context;
}

export function ObservationError() {
  const { phase, reload } = useObservations();
  if (phase !== "error") return null;

  return (
    <div className="catalog-warning" role="status">
      <AlertCircle size={17} aria-hidden="true" />
      <span>No se pudo abrir tu lista de observación.</span>
      <button className="inline-button" type="button" onClick={reload}>Reintentar</button>
    </div>
  );
}

export function MutationNotice({ inDialog = false }: { inDialog?: boolean }) {
  const { failed, change, dismissFailed } = useObservations();
  if (!failed) return null;

  return (
    <div className={"mutation-notice" + (inDialog ? " modal-notice" : " page-notice")} role="alert">
      <AlertCircle size={19} aria-hidden="true" />
      <span>No se pudo actualizar tu lista.</span>
      <button className="inline-button" type="button" onClick={() => change(failed)}>Reintentar</button>
      <button className="icon-button notice-dismiss" type="button" aria-label="Cerrar aviso" onClick={dismissFailed}>
        <X size={17} aria-hidden="true" />
      </button>
    </div>
  );
}

export function SavedLabel() {
  return <><Check size={18} aria-hidden="true" /> En mi lista</>;
}
