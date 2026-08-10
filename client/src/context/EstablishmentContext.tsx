import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { establishmentApi, Establishment } from "../api/establishment";
import { useAuth } from "./AuthContext";

type Status = "idle" | "loading" | "ready" | "none" | "error";

// abas do painel — controladas aqui para que a notificacao consiga
// forcar a troca de aba de fora do EstablishmentPanel
export type PanelTab =
  | "servicos"
  | "equipe"
  | "agenda"
  | "recebidos"
  | "clientes"
  | "galeria"
  | "produtos"
  | "caixa";

const LAST_KEY = "servicepro:lastEstablishmentId";

interface EstablishmentCtx {
  establishments: Establishment[];
  selected: Establishment | null;
  status: Status;
  creating: boolean;
  tab: PanelTab;
  setTab: (t: PanelTab) => void;
  select: (e: Establishment, tab?: PanelTab) => void;
  refresh: () => void;
  addLocal: (e: Establishment) => void;
  startCreating: () => void;
  stopCreating: () => void;
}

const Ctx = createContext<EstablishmentCtx | null>(null);

export function EstablishmentProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [selected, setSelected] = useState<Establishment | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<PanelTab>("recebidos");

  const refresh = useCallback(() => {
    setStatus("loading");
    establishmentApi
      .mine()
      .then((list) => {
        setEstablishments(list);
        if (list.length === 0) {
          setSelected(null);
          setStatus("none");
        } else {
          setSelected((prev) => {
            // 1) mantem o que ja estava selecionado
            if (prev) {
              const same = list.find((e) => e._id === prev._id);
              if (same) return same;
            }
            // 2) senao, tenta o ultimo usado (sobrevive ao reload da pagina)
            const lastId = localStorage.getItem(LAST_KEY);
            const last = lastId ? list.find((e) => e._id === lastId) : null;
            return last || list[0];
          });
          setStatus("ready");
        }
      })
      .catch(() => setStatus("error"));
  }, []);

  useEffect(() => {
    if (!user) {
      setEstablishments([]);
      setSelected(null);
      setStatus("idle");
      setCreating(false);
      return;
    }
    setSelected(null);
    refresh();
  }, [user?.id, refresh]);

  // guarda a escolha para restaurar depois de recarregar a pagina
  useEffect(() => {
    if (selected) localStorage.setItem(LAST_KEY, selected._id);
  }, [selected?._id]);

  // select aceita uma aba opcional: usado pelo clique na notificacao
  const select = useCallback((e: Establishment, nextTab?: PanelTab) => {
    setSelected(e);
    setCreating(false);
    if (nextTab) setTab(nextTab);
  }, []);

  const addLocal = useCallback((e: Establishment) => {
    setEstablishments((prev) => [e, ...prev]);
    setSelected(e);
    setCreating(false);
    setStatus("ready");
  }, []);

  const startCreating = useCallback(() => setCreating(true), []);
  const stopCreating = useCallback(() => setCreating(false), []);

  return (
    <Ctx.Provider
      value={{
        establishments,
        selected,
        status,
        creating,
        tab,
        setTab,
        select,
        refresh,
        addLocal,
        startCreating,
        stopCreating,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useEstablishments(): EstablishmentCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error(
      "useEstablishments deve ser usado dentro de EstablishmentProvider"
    );
  }
  return ctx;
}