import { useEffect, useState } from "react";
import { photoJobApi, PhotoJob, PhotoJobStatus } from "../api/photoJob";
import { formatPrice } from "../lib/time";

// Aba "Ensaios" (extra da categoria fotografia, modulo "foto"): cada job e um
// ensaio/evento com briefing, contrato (valores + termos, com PDF) e a galeria
// de entrega por LINK externo (sem upload das fotos). Ao marcar "entregue", o
// valor entra no caixa.

const STATUS: { key: PhotoJobStatus; label: string; cls: string }[] = [
  {
    key: "orcamento",
    label: "Orçamento",
    cls: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  },
  {
    key: "contratado",
    label: "Contratado",
    cls: "bg-teal-500/15 text-teal-600 dark:text-teal-100",
  },
  {
    key: "em_producao",
    label: "Em produção",
    cls: "bg-teal-500/15 text-teal-600 dark:text-teal-100",
  },
  {
    key: "entregue",
    label: "Entregue",
    cls: "bg-teal-500/25 text-teal-700 dark:text-teal-100",
  },
  {
    key: "cancelado",
    label: "Cancelado",
    cls: "bg-red-500/10 text-red-600 dark:text-red-300",
  },
];
const statusMeta = (s: PhotoJobStatus) =>
  STATUS.find((x) => x.key === s) || STATUS[0];

const input =
  "h-11 w-full rounded-xl border border-ink/15 bg-white px-3 outline-none focus:border-teal-500";
const area =
  "w-full rounded-xl border border-ink/15 bg-white px-3 py-2 outline-none focus:border-teal-500";
const lbl = "mb-1 block text-sm font-medium text-ink/70";

const emptyForm = () => ({
  title: "",
  clientName: "",
  clientPhone: "",
  eventType: "",
  eventDate: "",
  eventTime: "",
  location: "",
  briefing: "",
  deliverables: "",
  deliveryDeadline: "",
  price: "",
  deposit: "",
  paymentMethod: "pix" as "dinheiro" | "cartao" | "pix" | "outro",
  contractTerms: "",
  status: "orcamento" as PhotoJobStatus,
  deliveryLink: "",
  notes: "",
});
type FormState = ReturnType<typeof emptyForm>;

export function FotografiaManager({
  establishmentId,
}: {
  establishmentId: string;
}) {
  const [jobs, setJobs] = useState<PhotoJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    photoJobApi
      .list(establishmentId)
      .then(setJobs)
      .catch(() => setError("Não foi possível carregar os jobs."))
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [establishmentId]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const startNew = () => {
    setForm(emptyForm());
    setEditing("new");
    setError("");
  };
  const startEdit = (j: PhotoJob) => {
    setForm({
      title: j.title,
      clientName: j.clientName,
      clientPhone: j.clientPhone,
      eventType: j.eventType,
      eventDate: j.eventDate,
      eventTime: j.eventTime,
      location: j.location,
      briefing: j.briefing,
      deliverables: j.deliverables,
      deliveryDeadline: j.deliveryDeadline,
      price: j.price ? String(j.price) : "",
      deposit: j.deposit ? String(j.deposit) : "",
      paymentMethod: j.paymentMethod ?? "pix",
      contractTerms: j.contractTerms,
      status: j.status,
      deliveryLink: j.deliveryLink,
      notes: j.notes,
    });
    setEditing(j._id);
    setError("");
  };
  const cancel = () => {
    setEditing(null);
    setError("");
  };

  const save = async () => {
    if (!form.title.trim() && !form.clientName.trim()) {
      setError("Preencha ao menos o título ou o nome do cliente.");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      title: form.title.trim(),
      clientName: form.clientName.trim(),
      clientPhone: form.clientPhone.trim(),
      eventType: form.eventType.trim(),
      eventDate: form.eventDate.trim(),
      eventTime: form.eventTime.trim(),
      location: form.location.trim(),
      briefing: form.briefing.trim(),
      deliverables: form.deliverables.trim(),
      deliveryDeadline: form.deliveryDeadline.trim(),
      price: Math.max(0, Number(form.price) || 0),
      deposit: Math.max(0, Number(form.deposit) || 0),
      paymentMethod: form.paymentMethod,
      contractTerms: form.contractTerms.trim(),
      status: form.status,
      deliveryLink: form.deliveryLink.trim(),
      notes: form.notes.trim(),
    };
    try {
      if (editing === "new") {
        const created = await photoJobApi.create(establishmentId, payload);
        setJobs((list) => [created, ...list]);
      } else if (editing) {
        const updated = await photoJobApi.update(establishmentId, editing, payload);
        setJobs((list) => list.map((j) => (j._id === editing ? updated : j)));
      }
      setEditing(null);
    } catch {
      setError("Não foi possível salvar o job.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    await photoJobApi.remove(establishmentId, id);
    setJobs((list) => list.filter((j) => j._id !== id));
  };

  const openPdf = async (id: string) => {
    try {
      const blob = await photoJobApi.pdf(establishmentId, id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      setError("Não foi possível gerar o PDF.");
    }
  };

  // ---- editor ----
  if (editing) {
    const saldo = Math.max(0, (Number(form.price) || 0) - (Number(form.deposit) || 0));
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-ink">
            {editing === "new" ? "Novo ensaio / evento" : "Editar job"}
          </h3>
          <button
            onClick={cancel}
            className="rounded-lg border border-ink/15 px-3 py-1.5 text-sm font-medium text-ink/70 transition hover:bg-sand"
          >
            Voltar
          </button>
        </div>

        <div className="space-y-4 rounded-2xl border border-ink/10 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className={lbl}>Título</span>
              <input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Ex: Casamento Ana & João"
                className={input}
              />
            </label>
            <label className="block">
              <span className={lbl}>Cliente</span>
              <input
                value={form.clientName}
                onChange={(e) => set("clientName", e.target.value)}
                placeholder="Nome do cliente"
                className={input}
              />
            </label>
            <label className="block">
              <span className={lbl}>Telefone</span>
              <input
                value={form.clientPhone}
                onChange={(e) => set("clientPhone", e.target.value)}
                placeholder="(38) 99999-0000"
                className={input}
              />
            </label>
            <label className="block">
              <span className={lbl}>Tipo</span>
              <input
                value={form.eventType}
                onChange={(e) => set("eventType", e.target.value)}
                placeholder="Casamento, book, corporativo..."
                className={input}
              />
            </label>
            <label className="block">
              <span className={lbl}>Local</span>
              <input
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
                placeholder="Onde será"
                className={input}
              />
            </label>
            <label className="block">
              <span className={lbl}>Data do evento</span>
              <input
                value={form.eventDate}
                onChange={(e) => set("eventDate", e.target.value)}
                placeholder="Ex: 20/12/2026"
                className={input}
              />
            </label>
            <label className="block">
              <span className={lbl}>Horário</span>
              <input
                value={form.eventTime}
                onChange={(e) => set("eventTime", e.target.value)}
                placeholder="Ex: 16h"
                className={input}
              />
            </label>
          </div>

          {/* Briefing */}
          <label className="block">
            <span className={lbl}>Briefing</span>
            <textarea
              value={form.briefing}
              onChange={(e) => set("briefing", e.target.value)}
              rows={3}
              placeholder="Estilo desejado, referências, momentos que não podem faltar..."
              className={area}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={lbl}>Entregáveis</span>
              <input
                value={form.deliverables}
                onChange={(e) => set("deliverables", e.target.value)}
                placeholder="Ex: 50 fotos tratadas + álbum 30x30"
                className={input}
              />
            </label>
            <label className="block">
              <span className={lbl}>Prazo de entrega</span>
              <input
                value={form.deliveryDeadline}
                onChange={(e) => set("deliveryDeadline", e.target.value)}
                placeholder="Ex: 30 dias após o evento"
                className={input}
              />
            </label>
          </div>

          {/* Valores + status */}
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className={lbl}>Valor total (R$)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                placeholder="0"
                className={input}
              />
            </label>
            <label className="block">
              <span className={lbl}>Sinal / entrada (R$)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.deposit}
                onChange={(e) => set("deposit", e.target.value)}
                placeholder="0"
                className={input}
              />
            </label>
            <div className="flex flex-col justify-end">
              <span className={lbl}>Saldo</span>
              <div className="flex h-11 items-center rounded-xl bg-teal-500/10 px-3 font-semibold text-teal-600 dark:text-teal-100">
                {formatPrice(saldo)}
              </div>
            </div>
            <label className="block">
              <span className={lbl}>Forma de pagamento</span>
              <select
                value={form.paymentMethod}
                onChange={(e) =>
                  set(
                    "paymentMethod",
                    e.target.value as FormState["paymentMethod"]
                  )
                }
                className="h-11 w-full rounded-xl border border-ink/15 bg-white px-3 outline-none focus:border-teal-500"
              >
                <option value="pix">PIX</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="cartao">Cartão</option>
                <option value="outro">Outro</option>
              </select>
            </label>
            <label className="block">
              <span className={lbl}>Status</span>
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value as PhotoJobStatus)}
                className="h-11 w-full rounded-xl border border-ink/15 bg-white px-3 outline-none focus:border-teal-500"
              >
                {STATUS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-ink/40">
                "Contratado" lança o sinal no caixa; "Entregue" lança o saldo
                (se houver caixa aberto).
              </span>
            </label>
          </div>

          {/* Termos do contrato */}
          <label className="block">
            <span className={lbl}>Termos do contrato</span>
            <textarea
              value={form.contractTerms}
              onChange={(e) => set("contractTerms", e.target.value)}
              rows={4}
              placeholder="Cláusulas: uso de imagem, remarcação, cancelamento, direitos autorais, prazos..."
              className={area}
            />
          </label>

          {/* Entrega (link externo) */}
          <label className="block">
            <span className={lbl}>Link de entrega</span>
            <input
              value={form.deliveryLink}
              onChange={(e) => set("deliveryLink", e.target.value)}
              placeholder="Link da galeria (Drive, WeTransfer, Pixieset...)"
              className={input}
            />
            <span className="mt-1 block text-xs text-ink/40">
              A entrega é por link — nada é carregado aqui. Sai também no PDF.
            </span>
          </label>

          <label className="block">
            <span className={lbl}>Observações</span>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              className={area}
            />
          </label>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="h-11 rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button
              onClick={cancel}
              disabled={saving}
              className="h-11 rounded-xl border border-ink/15 px-6 font-medium text-ink/70 transition hover:bg-sand disabled:opacity-60"
            >
              Cancelar
            </button>
            {editing !== "new" && (
              <button
                type="button"
                onClick={() => openPdf(editing)}
                className="ml-auto h-11 rounded-xl border border-teal-500 px-6 font-semibold text-teal-600 transition hover:bg-teal-500 hover:text-white dark:text-teal-100"
              >
                Gerar contrato PDF
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---- lista ----
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ink/60">
          {jobs.length} ensaio{jobs.length !== 1 ? "s" : ""} / evento
          {jobs.length !== 1 ? "s" : ""}
        </p>
        <button
          onClick={startNew}
          className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600"
        >
          + Novo ensaio
        </button>
      </div>

      {loading ? (
        <p className="text-ink/50">Carregando...</p>
      ) : jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/20 p-8 text-center text-ink/50">
          Nenhum ensaio ainda. Crie o primeiro.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {jobs.map((j) => {
            const m = statusMeta(j.status);
            return (
              <button
                key={j._id}
                onClick={() => startEdit(j)}
                className="rounded-2xl border border-ink/10 bg-white p-4 text-left transition hover:border-teal-500"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-ink/40">
                      Job #{j.number}
                    </p>
                    <h4 className="truncate font-display font-bold text-ink">
                      {j.title || j.clientName || "Sem título"}
                    </h4>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${m.cls}`}
                  >
                    {m.label}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm text-ink/60">
                  {[j.eventType, j.eventDate, j.clientName]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-semibold text-teal-600 dark:text-teal-100">
                    {formatPrice(j.price)}
                  </span>
                  <span className="flex items-center gap-3">
                    {j.deliveryLink && (
                      <span className="text-xs font-medium text-ink/50">
                        entrega ✓
                      </span>
                    )}
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        openPdf(j._id);
                      }}
                      className="text-xs font-medium text-teal-600 hover:underline dark:text-teal-100"
                    >
                      PDF
                    </span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(j._id);
                      }}
                      className="text-xs font-medium text-red-500 hover:underline"
                    >
                      Remover
                    </span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
