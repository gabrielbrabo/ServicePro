import { useEffect, useState } from "react";
import { PageContainer } from "../components/NavBar";
import { EstablishmentForm } from "../components/EstablishmentForm";
import { EstablishmentPanel } from "../components/EstablishmentPanel";
import { useEstablishments } from "../context/EstablishmentContext";

export function ProviderDashboard() {
  const {
    selected,
    status,
    creating,
    refresh,
    addLocal,
    stopCreating,
  } = useEstablishments();

  const [modalOpen, setModalOpen] = useState(true);

  useEffect(() => {
    if (status === "idle") refresh();
  }, [status, refresh]);

  useEffect(() => {
    if (status === "none") setModalOpen(true);
  }, [status]);

  const blocked = status === "none" && modalOpen;

  return (
    <PageContainer>
      <div
        className={
          blocked ? "pointer-events-none select-none blur-sm" : undefined
        }
        aria-hidden={blocked}
      >
        {(status === "idle" || status === "loading") && (
          <p className="text-ink/50">Carregando seus negócios...</p>
        )}

        {status === "error" && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-ink/70">
            <span>Não foi possível verificar seus negócios agora.</span>
            <button
              onClick={refresh}
              className="rounded-lg bg-amber-400 px-3 py-1.5 font-semibold text-ink transition hover:bg-amber-500"
            >
              Tentar de novo
            </button>
          </div>
        )}

        {status === "none" && !creating && (
          <div className="mx-auto max-w-xl rounded-2xl border border-ink/10 bg-white p-8 text-center">
            <span className="inline-block rounded-full bg-teal-50 px-3 py-1 text-sm font-medium text-teal-600">
              Nenhum negócio
            </span>
            <h1 className="mt-3 font-display text-2xl font-bold text-ink">
              Você ainda não tem um negócio
            </h1>
            <p className="mt-1 text-ink/60">
              Crie um para cadastrar serviços, abrir sua agenda e receber
              agendamentos de clientes.
            </p>
            <button
              onClick={() => setModalOpen(true)}
              className="mt-5 inline-flex h-12 items-center justify-center rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600"
            >
              Cadastrar um negócio
            </button>
          </div>
        )}

        {/* form de novo negocio (acionado pela NavBar) */}
        {creating && (
          <div className="rounded-2xl border border-ink/10 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-ink">
                Novo negócio
              </h2>
              <button
                onClick={stopCreating}
                className="text-sm font-medium text-ink/60 hover:underline"
              >
                Cancelar
              </button>
            </div>
            <EstablishmentForm onCreated={(e) => addLocal(e)} />
          </div>
        )}

        {/* painel do negocio selecionado */}
        {status === "ready" && !creating && selected && (
          <EstablishmentPanel key={selected._id} establishment={selected} />
        )}
      </div>

      {blocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/40 p-4">
          <div className="my-auto w-full max-w-xl rounded-2xl border border-ink/10 bg-white p-6 shadow-2xl">
            <div className="mb-4">
              <span className="inline-block rounded-full bg-teal-50 px-3 py-1 text-sm font-medium text-teal-600">
                Primeiro passo
              </span>
              <h2 className="mt-3 font-display text-2xl font-bold text-ink">
                Cadastre seu negócio
              </h2>
              <p className="mt-1 text-ink/60">
                Para cadastrar serviços, abrir sua agenda e receber
                agendamentos de clientes, você precisa de um negócio.
              </p>
            </div>
            <EstablishmentForm
              onCreated={(e) => addLocal(e)}
              onCancel={() => setModalOpen(false)}
            />
          </div>
        </div>
      )}
    </PageContainer>
  );
}